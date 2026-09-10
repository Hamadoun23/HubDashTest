export default function Checkbox({ label, checked, onChange, id }) {
    return (
        <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-ardoise-700">
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="h-4 w-4 rounded border-ardoise-300 text-marque-600 focus:ring-marque-500/40"
            />
            {label}
        </label>
    );
}
