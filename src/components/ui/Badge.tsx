interface BadgeProps {
	label: string;
	color?: "success" | "error" | "warning" | "info" | "default";
}

const colorMap = {
	success: "bg-[#D4EDDA] text-[#155724]",
	error: "bg-error-container text-error-on-container",
	warning: "bg-[#FFF3CD] text-[#856404]",
	info: "bg-secondary-container text-secondary-on-container",
	default: "bg-surface-variant text-surface-on-variant",
};

export function Badge({ label, color = "default" }: BadgeProps) {
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorMap[color]}`}
		>
			{label}
		</span>
	);
}
