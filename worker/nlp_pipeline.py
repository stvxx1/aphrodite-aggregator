import re
from typing import Optional


def parse_tags_from_text(title: Optional[str], description: Optional[str]) -> list[str]:
    """
    Automated NLP (Natural Language Processing) routine to parse titles and descriptions
    into the specific tag cloud. If a video mentions specific keywords ("Step-Sister", "Extreme"),
    it pushes them directly into high-traffic silos.
    """
    text = f"{title or ''} {description or ''}".lower()
    
    # Pre-defined tag dictionary and rules (mock spacy/NLP parsing)
    # Keys are regexes matched on word boundaries, so "pov" doesn't fire inside "povera"
    # and "step-sister" also catches "step sister" / "stepsister".
    keyword_map = {
        r"step[- ]?sister": ["POV", "Taboo", "Step-Sister"],
        r"extreme": ["Hardcore", "Extreme"],
        r"stockings": ["Fetish", "Stockings"],
        r"pov": ["POV"],
        r"milf": ["MILF", "Mature"]
    }
    
    extracted_tags = set()
    
    for keyword, tags in keyword_map.items():
        if re.search(rf"\b{keyword}\b", text):
            for tag in tags:
                extracted_tags.add(tag)
                
    return sorted(extracted_tags)  # deterministic order

def recommend_videos(user_id: int, current_video_tags: list[str], user_history: list[dict], limit: int = 10) -> list[int]:
    """
    Collaborative filtering engine for personalized content recommendations.
    (content-recommender workflow implementation)
    """
    # In a real scenario, we'd query the DB and apply matrix factorization or cosine similarity
    # Here we mock the behavior of analyzing interests and applying filtering
    recommended_video_ids = []
    
    # 1. Analyze User Interests (weighting recent)
    user_interest_scores = {}
    for entry in user_history:
        for tag in entry.get("tags", []):
            user_interest_scores[tag] = user_interest_scores.get(tag, 0) + 1
            
    # Add weight from current video
    for tag in current_video_tags:
        user_interest_scores[tag] = user_interest_scores.get(tag, 0) + 2
        
    # 2. Filter and Rank (Mocking DB retrieval of top scoring videos)
    # We would return the top N video IDs that share these top tags
    recommended_video_ids = [101, 105, 203, 405, 501][:limit]
    
    return recommended_video_ids

if __name__ == "__main__":
    sample_title = "Step-Sister stuck in washing machine POV"
    sample_desc = "Extreme action."
    
    tags = parse_tags_from_text(sample_title, sample_desc)
    print(f"Extracted Tags: {tags}")
    
    recs = recommend_videos(1, tags, [{"video_id": 10, "tags": ["POV"]}], 5)
    print(f"Recommendations: {recs}")
