import { Chip } from "@/components/ui/Chip";
import type { ClinicProfileSummary } from "@/lib/types";

/**
 * Who the doctor is and what they treat, from the clinic's file. A caller with any other
 * problem gets no token: Parchi says who to see instead. The doctor changes this list on
 * the dashboard's Clinic settings page.
 */
export function DoctorScope({ profile }: { profile: ClinicProfileSummary }) {
  const referrals = Object.entries(profile.refers);
  return (
    <section className="border-b border-rule p-4" aria-label="What this doctor treats" data-testid="doctor-scope">
      <p className="text-[13px] text-night">
        <span className="font-semibold" data-testid="doctor-name">{profile.doctor}</span>
        <span className="text-night-soft"> · {profile.speciality}</span>
      </p>
      <p className="mt-2.5 text-[12px] font-semibold text-night-soft">Treats here</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5" data-testid="doctor-treats">
        {profile.treats.map((label) => (
          <li key={label}>
            <Chip tone="wall">{label}</Chip>
          </li>
        ))}
      </ul>
      {referrals.length > 0 && (
        <details className="group mt-3 text-[12px]">
          <summary className="cursor-pointer rounded text-night-soft marker:text-night-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris">
            Sent elsewhere, no token ({referrals.length})
          </summary>
          <dl className="mt-1.5 space-y-1" data-testid="doctor-refers">
            {referrals.map(([label, see]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-night-soft">{label}</dt>
                <dd lang="hi-Latn" className="text-right text-night-faint">{see}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
