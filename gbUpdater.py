import json
categories = [
    "Addition",
    "Removal",
    "Overhaul",
    "Adjustment",
    "Amendment",
    "Improvement",
    "Optimization",
    "Tweak",
    "Suggestion",
    "Feature",
    "Refactor",
    "Bugfix"
]

# Abbreviation mapping (first 3 letters, lowercase)
abbrev_map = {cat[:3].lower(): cat for cat in categories}

def get_category(input_str: str) -> str | None:
    """Match input to a category using abbreviations or full name."""
    input_lower = input_str.lower().strip()
    # Check exact match first
    for cat in categories:
        if cat.lower() == input_lower:
            return cat
    # Check abbreviation (first 3 chars)
    if input_lower[:3] in abbrev_map:
        return abbrev_map[input_lower[:3]]
    return None

def main():
    print("=== GameBanana Update Creator ===\n")
    
    # Update name (mandatory)
    while True:
        name = input("Update name: ").strip()
        if name:
            break
        print("Update name is required.")
    
    # Update version (mandatory)
    while True:
        version = input("Update version: ").strip()
        if version:
            break
        print("Update version is required.")
    
    # Changes (text + category pairs)
    changes = []
    print("\n--- Reading changes from Notes.md ---")
    print(f"Categories: {', '.join(categories)}")
    print("(Use abbreviations like 'add', 'rem', 'bug', etc.)\n")
    
    # Read changes from Notes.md
    try:
        with open("Notes.md", "r", encoding="utf-8") as f:
            change_lines = list(filter(lambda x: not x.startswith("#"), [line.strip().replace("* ","") for line in f.readlines() if line.strip()]))
    except FileNotFoundError:
        print("Notes.md not found. Please create it with your changes.")
        return
    
    for text in change_lines:
        print(f"\nChange: {text}")
        
        # Get category
        while True:
            cat_input = input("Category: ").strip()
            category = get_category(cat_input)
            if category:
                break
            print(f"Invalid category. Use one of: {', '.join(categories)}")
        
        changes.append({"text": text, "cat": category})
        print(f"  Added: [{category}]")
    
    # Update blurb (multiple lines until blank)
    print("\n--- Update blurb (enter blank line to finish) ---")
    blurb_lines = []
    while True:
        line = input()
        if not line:
            break
        blurb_lines.append(line)
    blurb = "<p>" + "</p><p>".join(blurb_lines) + "</p>" if blurb_lines else ""
    
    # # File row IDs (optional)
    # files_input = input("\nFile row IDs (comma-separated, optional): ").strip()
    # file_ids = []
    # if files_input:
    #     file_ids = [int(x.strip()) for x in files_input.split(",") if x.strip().isdigit()]
    
    # Significant (optional)
    sig_input = input("Significant update? (y/n, default: n): ").strip().lower()
    is_significant = sig_input == "y"
    
    # Build the payload
    payload = {
        "_sName": name,
        "_sVersion": version,
        "_aChangeLog": changes,
        "_sText": blurb,
        "_bIsSignificant": is_significant
    }
    jsfunction = f"""function updateTool(toolId, ...fileIds) {{
    const payload = {json.dumps(payload)};
    payload._aFileRowIds = fileIds || [];
    fetch("https://gamebanana.com/apiv11/Tool/" + toolId + "/Update", {{
        body: JSON.stringify(payload),
        method: "POST",
    }}).then(response => response.json())
    .then(data => console.log("Update response:", data))
    .catch(error => console.error("Error updating tool:", error));
}}"""
    print("\n=== JavaScript Function ===\n")
    print(jsfunction)
    print("\nSteps:\n 1] Copy the above function into your browser console on the GameBanana after you're logged in.\n 2] Enter 'updateTool(YOUR_SUBMISSION_ID, FILE_ID_1, FILE_ID_2, ...)' with the appropriate IDs to create the update.")
if __name__ == "__main__":
    main()
