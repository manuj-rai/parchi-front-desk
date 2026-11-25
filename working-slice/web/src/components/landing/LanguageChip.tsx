// Where the reference shows a stack of user avatars and a user count, Parchi shows what it
// actually offers: the languages a caller can use. No invented numbers.
const LANGUAGES = [
  { short: "हि", name: "Hindi" },
  { short: "Hi", name: "Hinglish" },
  { short: "En", name: "English" },
];

export function LanguageChip() {
  return (
    <p className="mx-auto inline-flex items-center gap-2.5 rounded-full bg-frost/90 py-1.5 pl-1.5 pr-4 shadow-md shadow-night/5 ring-1 ring-iris-wash xl:mx-0">
      <span aria-hidden className="flex -space-x-2">
        {LANGUAGES.map((language) => (
          <span key={language.name} className="grid size-7 place-items-center rounded-full bg-iris-wash text-[11px] font-bold text-iris-deep ring-2 ring-frost">
            {language.short}
          </span>
        ))}
      </span>
      <span className="text-[13px] font-semibold text-night">Hindi, Hinglish, English</span>
    </p>
  );
}
