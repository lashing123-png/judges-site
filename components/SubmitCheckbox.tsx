'use client';

// תיבת סימון בטופס GET ששולחת את הטופס מיד כשמשנים אותה (למשל "הצגת תחרויות עבר")
export default function SubmitCheckbox({ name, value = '1', checked, label }: { name: string; value?: string; checked: boolean; label: string }) {
  return (
    <label className="check" style={{ whiteSpace: 'nowrap' }}>
      <input type="checkbox" name={name} value={value} defaultChecked={checked} onChange={(e) => e.currentTarget.form?.requestSubmit()} /> {label}
    </label>
  );
}
