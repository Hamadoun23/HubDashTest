export default function Checkbox({ label, checked, onChange, id }) {
    return (
        <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={onChange}
                className="h-4 w-4 rounded border-gray-300 text-gda-orange focus:ring-gda-orange/40"
            />
            {label}
        </label>
    );
}
