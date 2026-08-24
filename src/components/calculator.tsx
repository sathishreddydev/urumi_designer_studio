"use client";

import { useCallback, useEffect, useState } from "react";
import { CalculatorDisplay } from "./calculator-display";
import { CalculatorKey } from "./calculator-key";

type Operator = "+" | "−" | "×" | "÷";

export function Calculator() {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(true);
  const [expression, setExpression] = useState("");

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate
  // ─────────────────────────────────────────────────────────────────────────

  const calculate = useCallback(
    (a: number, b: number, op: Operator): number => {
      let result: number;

      switch (op) {
        case "+":
          result = a + b;
          break;

        case "−":
          result = a - b;
          break;

        case "×":
          result = a * b;
          break;

        case "÷":
          result = b === 0 ? 0 : a / b;
          break;

        default:
          result = b;
      }

      // Remove floating point noise
      return Math.round(result * 100000000) / 100000000;
    },
    []
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Number
  // ─────────────────────────────────────────────────────────────────────────

  const inputDigit = useCallback(
    (digit: string) => {
      if (waitingForOperand) {
        setDisplay(digit);
        setWaitingForOperand(false);
        return;
      }

      setDisplay((current) =>
        current === "0" ? digit : current + digit
      );
    },
    [waitingForOperand]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Decimal
  // ─────────────────────────────────────────────────────────────────────────

  const inputDecimal = useCallback(() => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }

    setDisplay((current) =>
      current.includes(".") ? current : `${current}.`
    );
  }, [waitingForOperand]);

  // ─────────────────────────────────────────────────────────────────────────
  // Operator
  // ─────────────────────────────────────────────────────────────────────────

  const handleOperator = useCallback(
    (nextOperator: Operator) => {
      const current = Number(display);

      if (previousValue !== null && operator && !waitingForOperand) {
        const result = calculate(
          previousValue,
          current,
          operator
        );

        setDisplay(String(result));
        setPreviousValue(result);
        setExpression(`${result} ${nextOperator}`);
      } else {
        setPreviousValue(current);
        setExpression(`${current} ${nextOperator}`);
      }

      setOperator(nextOperator);
      setWaitingForOperand(true);
    },
    [
      display,
      previousValue,
      operator,
      waitingForOperand,
      calculate,
    ]
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Equals
  // ─────────────────────────────────────────────────────────────────────────

  const handleEquals = useCallback(() => {
    if (previousValue === null || operator === null) {
      return;
    }

    const current = Number(display);

    const result = calculate(
      previousValue,
      current,
      operator
    );

    setExpression(
      `${previousValue} ${operator} ${current} =`
    );

    setDisplay(String(result));
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  }, [
    display,
    previousValue,
    operator,
    calculate,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Clear
  // ─────────────────────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setDisplay("0");
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(true);
    setExpression("");
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Backspace
  // ─────────────────────────────────────────────────────────────────────────

  const handleBackspace = useCallback(() => {
    if (waitingForOperand) {
      return;
    }

    setDisplay((current) => {
      if (current.length <= 1) {
        setWaitingForOperand(true);
        return "0";
      }

      const next = current.slice(0, -1);

      if (next === "-" || next === "") {
        setWaitingForOperand(true);
        return "0";
      }

      return next;
    });
  }, [waitingForOperand]);

  // ─────────────────────────────────────────────────────────────────────────
  // Percentage
  // ─────────────────────────────────────────────────────────────────────────

  const handlePercentage = useCallback(() => {
    const value = Number(display);

    setDisplay(String(value / 100));
    setWaitingForOperand(true);
  }, [display]);

  // ─────────────────────────────────────────────────────────────────────────
  // Sign
  // ─────────────────────────────────────────────────────────────────────────

  const handleSign = useCallback(() => {
    if (display === "0") {
      return;
    }

    setDisplay((current) =>
      current.startsWith("-")
        ? current.slice(1)
        : `-${current}`
    );
  }, [display]);

  // ─────────────────────────────────────────────────────────────────────────
  // Keyboard support
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key;

      // Numbers
      if (/^[0-9]$/.test(key)) {
        inputDigit(key);
        return;
      }

      // Decimal
      if (key === ".") {
        inputDecimal();
        return;
      }

      // Operators
      if (key === "+") {
        handleOperator("+");
        return;
      }

      if (key === "-") {
        handleOperator("−");
        return;
      }

      if (key === "*") {
        handleOperator("×");
        return;
      }

      if (key === "/") {
        event.preventDefault();
        handleOperator("÷");
        return;
      }

      // Equals
      if (key === "=" || key === "Enter") {
        handleEquals();
        return;
      }

      // Backspace
      if (key === "Backspace") {
        handleBackspace();
        return;
      }

      // Escape
      if (key === "Escape" || key === "Delete") {
        handleClear();
        return;
      }

      // Percentage
      if (key === "%") {
        handlePercentage();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    inputDigit,
    inputDecimal,
    handleOperator,
    handleEquals,
    handleBackspace,
    handleClear,
    handlePercentage,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="pt-2">
      <div className="rounded-[28px] border border-border bg-muted/20 p-3 sm:p-4 shadow-sm">
        {/* Display */}
        <CalculatorDisplay
          value={display}
          expression={expression}
        />

        <div className="grid grid-cols-4 gap-2 mt-3">
          {/* Row 1 */}
          <CalculatorKey
            variant="action"
            onClick={handleClear}
          >
            AC
          </CalculatorKey>

          <CalculatorKey
            variant="action"
            onClick={handleBackspace}
          >
            ⌫
          </CalculatorKey>

          <CalculatorKey
            variant="action"
            onClick={handlePercentage}
          >
            %
          </CalculatorKey>

          <CalculatorKey
            variant="operator"
            onClick={() => handleOperator("÷")}
          >
            ÷
          </CalculatorKey>

          {/* Row 2 */}
          <CalculatorKey onClick={() => inputDigit("7")}>
            7
          </CalculatorKey>

          <CalculatorKey onClick={() => inputDigit("8")}>
            8
          </CalculatorKey>

          <CalculatorKey onClick={() => inputDigit("9")}>
            9
          </CalculatorKey>

          <CalculatorKey
            variant="operator"
            onClick={() => handleOperator("×")}
          >
            ×
          </CalculatorKey>

          {/* Row 3 */}
          <CalculatorKey onClick={() => inputDigit("4")}>
            4
          </CalculatorKey>

          <CalculatorKey onClick={() => inputDigit("5")}>
            5
          </CalculatorKey>

          <CalculatorKey onClick={() => inputDigit("6")}>
            6
          </CalculatorKey>

          <CalculatorKey
            variant="operator"
            onClick={() => handleOperator("−")}
          >
            −
          </CalculatorKey>

          {/* Row 4 */}
          <CalculatorKey onClick={() => inputDigit("1")}>
            1
          </CalculatorKey>

          <CalculatorKey onClick={() => inputDigit("2")}>
            2
          </CalculatorKey>

          <CalculatorKey onClick={() => inputDigit("3")}>
            3
          </CalculatorKey>

          <CalculatorKey
            variant="operator"
            onClick={() => handleOperator("+")}
          >
            +
          </CalculatorKey>

          {/* Row 5 */}
          <CalculatorKey
            variant="action"
            onClick={handleSign}
          >
            ±
          </CalculatorKey>

          <CalculatorKey
            className="col-span-1"
            onClick={() => inputDigit("0")}
          >
            0
          </CalculatorKey>

          <CalculatorKey onClick={inputDecimal}>
            .
          </CalculatorKey>

          <CalculatorKey
            variant="equals"
            onClick={handleEquals}
          >
            =
          </CalculatorKey>
        </div>

        {/* Keyboard hint */}
        <p className="text-[10px] sm:text-[11px] text-center text-muted-foreground mt-3">
          Keyboard supported · 0–9 · + − × ÷ · Enter · Backspace
        </p>
      </div>
    </div>
  );
}