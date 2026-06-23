#!/bin/bash
# Generate all project files for Transcript Zone
BASE="/home/nodexxplorer/Desktop/Aces here/frontend/src"

# Create directory structure
mkdir -p "$BASE"/{api/mock,stores,hooks,types,utils}
mkdir -p "$BASE"/components/{layout,ui,data-display,forms,feedback}
mkdir -p "$BASE"/pages/{auth,onboarding,student,lecturer,class-rep,bursar,admin}

echo "Directory structure created!"
ls -R "$BASE" | head -80
