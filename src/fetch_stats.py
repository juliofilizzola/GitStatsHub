import os
import json
import requests
from datetime import datetime, timezone

API = "https://api.github.com"
TIMEOUT = 30


def rest_headers():
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def rest_get(url):
    r = requests.get(url, headers=rest_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def graphql(query: str, variables: dict) -> dict:
    """Executa uma query GraphQL e falha de forma explícita em qualquer erro."""
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN é obrigatório para consultar a API GraphQL")
    r = requests.post(
        f"{API}/graphql",
        json={"query": query, "variables": variables},
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    payload = r.json()
    if payload.get("errors"):
        raise RuntimeError(f"Erro GraphQL: {payload['errors']}")
    return payload["data"]


def fetch_repos(username: str) -> list:
    repos, page = [], 1
    while True:
        data = rest_get(f"{API}/users/{username}/repos?per_page=100&page={page}&type=owner")
        if not data:
            break
        repos.extend(data)
        page += 1
    return repos


CONTRIB_QUERY = """
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      restrictedContributionsCount
      contributionCalendar { totalContributions }
    }
  }
}
"""

LANG_QUERY = """
query($login: String!, $cursor: String) {
  user(login: $login) {
    repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC) {
      pageInfo { hasNextPage endCursor }
      nodes {
        languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
          edges { size node { name color } }
        }
      }
    }
  }
}
"""


def fetch_contributions(username: str) -> dict:
    c = graphql(CONTRIB_QUERY, {"login": username})["user"]["contributionsCollection"]
    return {
        "commits": c["totalCommitContributions"],
        "pull_requests": c["totalPullRequestContributions"],
        "issues": c["totalIssueContributions"],
        "reviews": c["totalPullRequestReviewContributions"],
        "private": c["restrictedContributionsCount"],
        "total": c["contributionCalendar"]["totalContributions"],
    }


def fetch_languages(username: str) -> list:
    """Linguagens ponderadas por bytes de código (apenas repos próprios e públicos)."""
    totals, cursor = {}, None
    while True:
        repos = graphql(LANG_QUERY, {"login": username, "cursor": cursor})["user"]["repositories"]
        for repo in repos["nodes"]:
            for edge in repo["languages"]["edges"]:
                name = edge["node"]["name"]
                item = totals.setdefault(name, {"name": name, "bytes": 0, "color": edge["node"]["color"]})
                item["bytes"] += edge["size"]
        if not repos["pageInfo"]["hasNextPage"]:
            break
        cursor = repos["pageInfo"]["endCursor"]
    return sorted(totals.values(), key=lambda x: x["bytes"], reverse=True)


def get_stats(username: str) -> dict:
    user = rest_get(f"{API}/users/{username}")
    repos = fetch_repos(username)

    total_stars = total_forks = 0
    forked = []
    original_count = 0

    for repo in repos:
        if repo.get("fork"):
            forked.append({
                "name": repo.get("name"),
                "full_name": repo.get("full_name"),
                "html_url": repo.get("html_url"),
                "description": repo.get("description") or "",
                "language": repo.get("language") or "",
                "stargazers_count": repo.get("stargazers_count", 0),
                "forks_count": repo.get("forks_count", 0),
            })
            continue
        original_count += 1
        total_stars += repo.get("stargazers_count", 0)
        total_forks += repo.get("forks_count", 0)

    public_repos = user.get("public_repos", len(repos))

    return {
        "profile": {
            "name": user.get("name") or username,
            "login": username,
            "avatar_url": user.get("avatar_url"),
            "public_repos": public_repos,
            "original_repos": original_count if len(repos) == public_repos else max(0, public_repos - len(forked)),
            "forked_repos": len(forked),
            "followers": user.get("followers", 0),
            "total_stars": total_stars,
            "total_forks": total_forks,
        },
        "forked_repos": forked,
        "languages": fetch_languages(username),
        "contributions": fetch_contributions(username),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def write_json(path: str, stats: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    print(f"Successfully generated {path}")


def main():
    username = os.getenv("GITHUB_USERNAME") or os.getenv("GITHUB_ACTOR")
    if not username:
        raise ValueError("GITHUB_USERNAME or GITHUB_ACTOR env var is required")

    print(f"Fetching stats for user: {username}")
    stats = get_stats(username)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    write_json(os.path.join(base_dir, "public", "stats.json"), stats)

    dist_dir = os.path.join(base_dir, "dist")
    if os.path.exists(dist_dir):
        write_json(os.path.join(dist_dir, "stats.json"), stats)


if __name__ == "__main__":
    main()
