#!/bin/sh
# Runs the pilot of one model: three arms, three seeds, three runs at a time.
# sh harness/pilot.sh sonnet|opus [version]
cd "$(dirname "$0")/.." || exit 1
MODEL=$1; VERSION=${2:-pilot3}
mkdir -p runs/$VERSION
for seed in 1 2 3; do for arm in a b c; do echo "$arm $seed"; done; done |
  xargs -P 3 -L 1 sh -c 'node harness/run.mjs --arm $0 --model '"$MODEL"' --seed $1 --version '"$VERSION"' >> runs/'"$VERSION"'/'"$MODEL"'-$0-$1.out 2>&1'
echo "pilot $MODEL finished" >> runs/$VERSION/pilot.done
