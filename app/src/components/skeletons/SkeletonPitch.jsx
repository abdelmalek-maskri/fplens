import PitchLayout from "../pitch/PitchLayout";

/**
 * Pitch skeleton with placeholder player cards in a 4-4-2 formation.
 * @param {string} id  Namespace for SVG pattern IDs (default "skeleton")
 */
export default function SkeletonPitch({ id = "skeleton" }) {
  const rows = [1, 4, 4, 2]; // GK, DEF, MID, FWD

  return (
    <PitchLayout id={id}>
      <div className="relative py-6 px-4 space-y-6">
        {rows.map((count, rowIdx) => (
          <div key={rowIdx} className="flex justify-center gap-3">
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="skeleton w-12 h-12 !rounded-md" />
                <div className="skeleton h-3 w-14" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </PitchLayout>
  );
}
