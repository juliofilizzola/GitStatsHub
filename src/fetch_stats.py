import os
import json
import requests
from datetime import datetime, timezone

def get_rest_headers():
    token = os.getenv("GITHUB_TOKEN")
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def fetch_user_data(username: str) -> dict:
    url = f"https://api.github.com/users/{username}"
    response = requests.get(url, headers=get_rest_headers())
    response.raise_for_status()
    return response.json()

def fetch_repos(username: str) -> list:
    repos = []
    page = 1
    while True:
        url = f"https://api.github.com/users/{username}/repos?per_page=100&page={page}"
        response = requests.get(url, headers=get_rest_headers())
        response.raise_for_status()
        data = response.json()
        if not data:
            break
        repos.extend(data)
        page += 1
    return repos

def get_stats(username: str) -> dict:
    user_data = fetch_user_data(username)
    repos = fetch_repos(username)

    total_stars = 0
    total_forks = 0
    languages = {}

    for repo in repos:
        # Ignore forks for stars and languages to be more accurate about original work
        if repo.get("fork"):
            continue
        
        total_stars += repo.get("stargazers_count", 0)
        total_forks += repo.get("forks_count", 0)
        
        lang = repo.get("language")
        if lang:
            languages[lang] = languages.get(lang, 0) + 1

    graphql_url = "https://api.github.com/graphql"
    query = """
    query($username: String!) {
      user(login: $username) {
        pullRequests(first: 1) {
          totalCount
        }
        issues(first: 1) {
          totalCount
        }
        contributionsCollection {
          contributionCalendar {
            totalContributions
          }
        }
      }
    }
    """
    
    token = os.getenv("GITHUB_TOKEN")
    prs_count = 0
    issues_count = 0
    commits_count = 0
    
    if token:
        gql_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        try:
            response = requests.post(graphql_url, json={"query": query, "variables": {"username": username}}, headers=gql_headers)
            if response.status_code == 200:
                gql_data = response.json().get("data", {}).get("user", {})
                if gql_data:
                    prs_count = gql_data.get("pullRequests", {}).get("totalCount", 0)
                    issues_count = gql_data.get("issues", {}).get("totalCount", 0)
                    commits_count = gql_data.get("contributionsCollection", {}).get("contributionCalendar", {}).get("totalContributions", 0)
        except Exception as e:
            print(f"Warning: Failed to fetch GraphQL data: {e}")
    
    stats = {
        "profile": {
            "name": user_data.get("name") or username,
            "login": username,
            "avatar_url": user_data.get("avatar_url"),
            "public_repos": user_data.get("public_repos"),
            "followers": user_data.get("followers"),
            "total_stars": total_stars,
            "total_forks": total_forks,
        },
        "languages": languages,
        "contributions": {
            "last_year_commits": commits_count,
            "total_prs": prs_count,
            "total_issues": issues_count
        },
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    return stats


def main():
    username = os.getenv("GITHUB_USERNAME") or os.getenv("GITHUB_ACTOR")
    if not username:
        raise ValueError("GITHUB_USERNAME or GITHUB_ACTOR env var is required")

    print(f"Fetching stats for user: {username}")
    stats = get_stats(username)

    # Descobre o caminho raiz do projeto para salvar em public/stats.json
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    public_dir = os.path.join(base_dir, "public")
    os.makedirs(public_dir, exist_ok=True)

    output_file = os.path.join(public_dir, "stats.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    print(f"Successfully generated {output_file}")

if __name__ == "__main__":
    main()
