import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface SelectOption {
	value: string;
	label: string;
}

interface SelectProps {
	value: string;
	onChange: (value: string) => void;
	options: SelectOption[];
	placeholder?: string;
	className?: string;
	disabled?: boolean;
}

export function Select({
	value,
	onChange,
	options,
	placeholder,
	className,
	disabled,
}: SelectProps) {
	return (
		<RadixSelect.Root
			value={value}
			onValueChange={onChange}
			disabled={disabled}
		>
			<RadixSelect.Trigger
				className={cn(
					"flex items-center justify-between gap-1.5",
					"text-sm px-2.5 py-1.5 rounded-lg",
					"border border-white/15 bg-surface-variant text-surface-on",
					"hover:border-white/25 transition-colors",
					"focus:outline-none focus:ring-1 focus:ring-primary/40",
					"disabled:opacity-50 disabled:cursor-not-allowed",
					"min-w-[120px]",
					className,
				)}
			>
				<RadixSelect.Value placeholder={placeholder} />
				<RadixSelect.Icon>
					<ChevronDown size={13} className="text-surface-on-variant shrink-0" />
				</RadixSelect.Icon>
			</RadixSelect.Trigger>

			<RadixSelect.Portal>
				<RadixSelect.Content
					position="popper"
					sideOffset={4}
					className={cn(
						"z-50 min-w-[var(--radix-select-trigger-width)]",
						"rounded-lg border border-white/15 bg-card-bg shadow-xl",
						"overflow-hidden",
						"animate-in fade-in-0 zoom-in-95",
					)}
				>
					<RadixSelect.Viewport className="p-1">
						{options.map((opt) => (
							<RadixSelect.Item
								key={opt.value}
								value={opt.value}
								className={cn(
									"relative flex items-center gap-2 px-2.5 py-1.5 rounded-md",
									"text-sm text-surface-on cursor-pointer select-none",
									"hover:bg-surface-variant/60 focus:bg-surface-variant/60",
									"focus:outline-none",
									"data-[state=checked]:text-primary",
								)}
							>
								<RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
								<RadixSelect.ItemIndicator className="ml-auto">
									<Check size={12} className="text-primary" />
								</RadixSelect.ItemIndicator>
							</RadixSelect.Item>
						))}
					</RadixSelect.Viewport>
				</RadixSelect.Content>
			</RadixSelect.Portal>
		</RadixSelect.Root>
	);
}
