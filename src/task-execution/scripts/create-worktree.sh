#!/bin/bash

# create-worktree.sh
# Creates a git worktree for the specified repository

# Arguments:
# $1 - full path to source repository
# $2 - full path to worktree directory

if [ $# -ne 2 ]; then
    echo "Usage: $0 <source-repo-path> <worktree-path>"
    exit 1
fi

SOURCE_REPO="$1"
WORKTREE_PATH="$2"

# Get the parent directory of the worktree path
WORKTREES_BASE="$(dirname "$WORKTREE_PATH")"

# Check if source repository exists
if [ ! -d "$SOURCE_REPO" ]; then
    echo "Error: Source repository does not exist: $SOURCE_REPO"
    exit 1
fi

# Check if source is a git repository
if [ ! -d "$SOURCE_REPO/.git" ]; then
    echo "Error: Source directory is not a git repository: $SOURCE_REPO"
    exit 1
fi

# Create worktrees base directory if it doesn't exist
if [ ! -d "$WORKTREES_BASE" ]; then
    echo "Creating worktrees base directory: $WORKTREES_BASE"
    mkdir -p "$WORKTREES_BASE"
fi

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
    echo "Worktree already exists: $WORKTREE_PATH"
    echo "Using existing worktree"
    exit 0
fi

echo "Creating worktree: $WORKTREE_PATH"
echo "Source repository: $SOURCE_REPO"

# Navigate to source repository and create worktree
cd "$SOURCE_REPO" || exit 1

# Create worktree from current branch
git worktree add "$WORKTREE_PATH"

if [ $? -eq 0 ]; then
    echo "Successfully created worktree: $WORKTREE_PATH"
else
    echo "Failed to create worktree"
    exit 1
fi
