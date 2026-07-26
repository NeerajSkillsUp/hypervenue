import os
from pathlib import Path
import pathspec

# Hardcoded default ignores (always skipped, even if not in .gitignore)
DEFAULT_IGNORE = {
    '.git', 'node_modules', '__pycache__', '.venv', 'env', 
    '.pytest_cache', '.vscode', '.idea', '.DS_Store', 'repo_digest.txt'
}

def load_gitignore(root_path):
    """Load .gitignore patterns and return a PathSpec matcher object."""
    gitignore_path = Path(root_path) / '.gitignore'
    patterns = list(DEFAULT_IGNORE)
    
    if gitignore_path.exists():
        try:
            with open(gitignore_path, 'r', encoding='utf-8', errors='ignore') as f:
                # Filter out empty lines and comments
                lines = [line.strip() for line in f if line.strip() and not line.strip().startswith('#')]
                patterns.extend(lines)
        except Exception as e:
            print(f"Warning: Could not read .gitignore ({e}). Using default ignores.")
            
    return pathspec.PathSpec.from_lines('gitwildmatch', patterns)

def is_binary(file_path):
    """Check if a file is binary by reading its first 1024 bytes."""
    try:
        with open(file_path, 'rb') as f:
            chunk = f.read(1024)
            if b'\x00' in chunk:
                return True
        return False
    except Exception:
        return True

def generate_tree(dir_path, spec, base_path, prefix=""):
    """Recursively build a visual directory tree string respecting ignores."""
    tree_str = ""
    try:
        entries = sorted(list(Path(dir_path).iterdir()), key=lambda e: (e.is_file(), e.name.lower()))
        
        # Filter entries using pathspec (must use relative paths from the base project directory)
        filtered_entries = []
        for entry in entries:
            rel_path = entry.relative_to(base_path)
            # pathspec directories match better if they end with a slash
            match_path = f"{rel_path}/" if entry.is_dir() else str(rel_path)
            
            if entry.name not in DEFAULT_IGNORE and not spec.match_file(match_path):
                filtered_entries.append(entry)
        
        for i, entry in enumerate(filtered_entries):
            is_last = (i == len(filtered_entries) - 1)
            connector = "└── " if is_last else "├── "
            
            tree_str += f"{prefix}{connector}{entry.name}\n"
            
            if entry.is_dir():
                next_prefix = prefix + ("    " if is_last else "│   ")
                tree_str += generate_tree(entry, spec, base_path, next_prefix)
    except Exception as e:
        tree_str += f"{prefix}[Error reading directory: {e}]\n"
    return tree_str

def aggregate_content(dir_path, spec, output_file):
    """Walk through files and append text contents, skipping ignored items."""
    base_path = Path(dir_path)
    try:
        for root, dirs, files in os.walk(base_path):
            # 1. Filter directories in-place to prevent os.walk from entering ignored folders
            valid_dirs = []
            for d in dirs:
                rel_dir = (Path(root) / d).relative_to(base_path)
                if d not in DEFAULT_IGNORE and not spec.match_file(f"{rel_dir}/"):
                    valid_dirs.append(d)
            dirs[:] = valid_dirs
            
            # 2. Process remaining valid files
            for file in sorted(files):
                file_path = Path(root) / file
                relative_path = file_path.relative_to(base_path)
                
                if file in DEFAULT_IGNORE or spec.match_file(str(relative_path)):
                    continue
                    
                if is_binary(file_path):
                    continue
                    
                try:
                    output_file.write(f"\n=======================================================\n")
                    output_file.write(f"FILE: {relative_path}\n")
                    output_file.write(f"=======================================================\n")
                    
                    with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                        output_file.write(f.read())
                    output_file.write("\n")
                except Exception as e:
                    output_file.write(f"\n[Error reading file {relative_path}: {e}]\n")
    except Exception as e:
        output_file.write(f"\n[Error processing directory content: {e}]\n")

def main():
    print("--- Local GitIngest Script (with .gitignore support) ---")
    target_input = input("Enter the full path of the target folder: ").strip()
    target_path = Path(target_input)
    
    if not target_path.exists() or not target_path.is_dir():
        print("Error: Invalid directory path.")
        return
        
    output_filename = "repo_digest.txt"
    output_path = target_path.parent / output_filename
    
    print("Loading .gitignore rules...")
    spec = load_gitignore(target_path)
    
    print(f"\nProcessing '{target_path.name}'...")
    
    with open(output_path, 'w', encoding='utf-8') as out_file:
        out_file.write(f"=======================================================\n")
        out_file.write(f"DIRECTORY STRUCTURE\n")
        out_file.write(f"=======================================================\n")
        out_file.write(f"{target_path.name}/\n")
        out_file.write(generate_tree(target_path, spec, target_path))
        out_file.write(f"\n")
        
        out_file.write(f"=======================================================\n")
        out_file.write(f"FILE CONTENTS\n")
        out_file.write(f"=======================================================\n")
        aggregate_content(target_path, spec, out_file)
        
    print(f"Success! Digest saved to: {output_path.resolve()}")

if __name__ == '__main__':
    main()
