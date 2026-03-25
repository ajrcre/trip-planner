"use client"

export function InputField({
  label,
  type = "text",
  value,
  onChange,
  required = false,
}: {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="text-red-500 mr-1">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-700"
      />
    </label>
  )
}
