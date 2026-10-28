import { useNavigate } from "react-router-dom";
import { HeaderBack, PageHeader } from "../components/PageHeader";

export function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-bg px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] text-ink">
      <main className="mx-auto w-full max-w-lg">
        <PageHeader
          title="Privacy"
          back={<HeaderBack label="Back" onClick={() => navigate(-1)} />}
        />
        <p className="mt-3 max-w-[65ch] text-[15px] leading-relaxed text-muted">
          MIRIN is a personal training log. This page says what the app stores
          and how to delete it.
        </p>

        <h2 className="mt-8 text-[15px] font-semibold tracking-tight">Account</h2>
        <p className="mt-1.5 max-w-[65ch] text-[15px] leading-relaxed text-muted">
          Name and email, from the form you fill in or from Google or Apple if
          you use those to sign in. Apple can hide your email. MIRIN stores the
          address Apple gives us.
        </p>

        <h2 className="mt-8 text-[15px] font-semibold tracking-tight">Profile</h2>
        <p className="mt-1.5 max-w-[65ch] text-[15px] leading-relaxed text-muted">
          Age, gender, and an avatar, if you set them. Age and gender are
          optional.
        </p>

        <h2 className="mt-8 text-[15px] font-semibold tracking-tight">
          Training log
        </h2>
        <p className="mt-1.5 max-w-[65ch] text-[15px] leading-relaxed text-muted">
          Sets, body weight, protein, and calories. Used only to show you your
          log. Not sold. Not used for advertising. Not written to HealthKit or
          iCloud.
        </p>

        <h2 className="mt-8 text-[15px] font-semibold tracking-tight">
          Who else sees it
        </h2>
        <ul className="mt-1.5 max-w-[65ch] list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-muted">
          <li>Supabase stores the account and the synced log.</li>
          <li>Google or Apple, only if you choose that sign-in.</li>
          <li>YouTube, only while a form video plays. The video is not downloaded.</li>
        </ul>

        <h2 className="mt-8 text-[15px] font-semibold tracking-tight">
          How long it is kept
        </h2>
        <p className="mt-1.5 max-w-[65ch] text-[15px] leading-relaxed text-muted">
          Until you delete the account. In the app, open Profile, then Account,
          then Delete account. That removes the login and the synced log. The
          copy on this device is removed at the same time. Deleting needs a
          connection.
        </p>

        <h2 className="mt-8 text-[15px] font-semibold tracking-tight">Children</h2>
        <p className="mt-1.5 max-w-[65ch] text-[15px] leading-relaxed text-muted">
          MIRIN is not for children under 13, and it is not in the Kids Category.
        </p>

        <h2 className="mt-8 text-[15px] font-semibold tracking-tight">Tracking</h2>
        <p className="mt-1.5 max-w-[65ch] text-[15px] leading-relaxed text-muted">
          MIRIN does not track you across other companies' apps or websites.
        </p>
      </main>
    </div>
  );
}
