import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, description, children }) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/50" onClick={onClose} />
            <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
                        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={18} />
                    </button>
                </div>
                <div className="px-5 py-4">{children}</div>
            </div>
        </div>
    );
}
