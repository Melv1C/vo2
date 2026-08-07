/** @typedef { { name: string; newVersion: string; type: string } } Release */

/**
 * Custom version commit message for Changesets (`commit` in `.changeset/config.json`).
 *
 * CI skipping is handled at push time with `git push -o ci.skip` so tags created from the same
 * commit can still trigger their own pipelines in GitLab.
 * https://gitlab.com/gitlab-org/gitlab/-/work_items/18798#note_1783474849
 *
 * @param { { releases: Release[] } } releasePlan
 */
export async function getVersionMessage(releasePlan) {
  const publishable = releasePlan.releases.filter((r) => r.type !== "none");
  const parts = publishable
    .map((r) => `${r.name}@${r.newVersion}`)
    .sort((a, b) => a.localeCompare(b));
  return `release: ${parts.join(", ")}`;
}
