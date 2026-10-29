/** @param {import('@coderline/alphatab').model.Score} score */
export function prepareImportedNotation(score) {
  for (const track of score.tracks) {
    for (const staff of track.staves) {
      if (staff.isPercussion && !staff.showStandardNotation && !staff.showTablature) {
        staff.showStandardNotation = true;
      }
    }
  }
}
