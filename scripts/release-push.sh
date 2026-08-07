#!/usr/bin/env sh

# Skip CI only for the release commit push. Tags are pushed separately without
# the option so GitLab can still run tag pipelines for the same commit.
git push --no-follow-tags -o ci.skip

for tag in $(git tag --points-at HEAD); do
  git push --quiet --no-follow-tags origin "$tag"
  echo "Pushed tag $tag"
done
