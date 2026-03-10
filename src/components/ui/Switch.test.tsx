import { fireEvent, render, screen } from "@testing-library/react";
import { Switch } from "./Switch";

describe("Switch", () => {
	it("calls onChange with toggled value", () => {
		const onChange = vi.fn();
		render(<Switch checked={false} onChange={onChange} label="Test" />);
		fireEvent.click(screen.getByRole("switch"));
		expect(onChange).toHaveBeenCalledWith(true);
	});

	it("does not call onChange when disabled", () => {
		const onChange = vi.fn();
		render(<Switch checked={false} onChange={onChange} disabled />);
		fireEvent.click(screen.getByRole("switch"));
		expect(onChange).not.toHaveBeenCalled();
	});
});
