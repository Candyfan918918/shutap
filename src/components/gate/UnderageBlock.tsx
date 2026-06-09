// Full-screen black block shown when the age gate rejects.
// No retry. No back button. By spec.
export function UnderageBlock() {
  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-3">
        <p className="text-white text-base sm:text-lg leading-relaxed">
          Shutap is for adults 18 and older. Come back when you're ready.
        </p>
      </div>
    </div>
  );
}
