/**
 * CortexWeaver Calculator - Advanced Mathematical Calculator
 * Built with CortexWeaver AI Agent Orchestration Framework
 * Features: Basic arithmetic, scientific functions, history, and more
 */

class CortexCalculator {
    constructor() {
        this.display = document.getElementById('display');
        this.history = [];
        this.memory = 0;
        this.currentInput = '';
        this.operator = null;
        this.previousInput = '';
        this.shouldResetDisplay = false;
        
        this.loadHistory();
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key >= '0' && e.key <= '9') {
                this.appendToDisplay(e.key);
            } else if (['+', '-', '*', '/'].includes(e.key)) {
                this.appendToDisplay(e.key === '*' ? '×' : e.key);
            } else if (e.key === 'Enter' || e.key === '=') {
                this.calculate();
            } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
                this.clearDisplay();
            } else if (e.key === 'Backspace') {
                this.deleteLast();
            } else if (e.key === '.') {
                this.appendToDisplay('.');
            }
        });
    }
    
    appendToDisplay(value) {
        if (this.shouldResetDisplay) {
            this.display.value = '';
            this.shouldResetDisplay = false;
        }
        
        const currentDisplay = this.display.value;
        
        // Handle operators
        if (['+', '-', '×', '/'].includes(value)) {
            if (currentDisplay === '' && value === '-') {
                this.display.value = '-';
                return;
            }
            
            if (currentDisplay !== '' && !['+', '-', '×', '/'].includes(currentDisplay.slice(-1))) {
                this.display.value += ' ' + value + ' ';
            }
            return;
        }
        
        // Handle decimal point
        if (value === '.') {
            const parts = currentDisplay.split(/[\+\-\×\/]/);
            const lastPart = parts[parts.length - 1].trim();
            if (lastPart.includes('.')) {
                return; // Don't add multiple decimal points
            }
        }
        
        this.display.value += value;
    }
    
    clearDisplay() {
        this.display.value = '';
        this.currentInput = '';
        this.operator = null;
        this.previousInput = '';
        this.shouldResetDisplay = false;
    }
    
    deleteLast() {
        let currentValue = this.display.value;
        if (currentValue.length > 0) {
            // If last character is a space (part of operator), remove the operator and spaces
            if (currentValue.endsWith(' ')) {
                currentValue = currentValue.trim();
                currentValue = currentValue.slice(0, -1).trim();
            } else {
                currentValue = currentValue.slice(0, -1);
            }
            this.display.value = currentValue;
        }
    }
    
    calculate() {
        const expression = this.display.value.trim();
        if (!expression) return;
        
        try {
            // Replace display operators with JavaScript operators
            let jsExpression = expression
                .replace(/×/g, '*')
                .replace(/÷/g, '/');
            
            // Validate expression
            if (!this.isValidExpression(jsExpression)) {
                throw new Error('Invalid expression');
            }
            
            // Calculate result using safe evaluation
            const result = this.evaluateExpression(jsExpression);
            
            // Handle special cases
            if (!isFinite(result)) {
                throw new Error('Mathematical error');
            }
            
            // Round to avoid floating point precision issues
            const roundedResult = Math.round(result * 1000000000000) / 1000000000000;
            
            // Add to history
            this.addToHistory(expression, roundedResult);
            
            // Update display
            this.display.value = roundedResult.toString();
            this.shouldResetDisplay = true;
            
        } catch (error) {
            this.display.value = 'Error';
            this.shouldResetDisplay = true;
            console.error('Calculation error:', error);
        }
    }
    
    isValidExpression(expression) {
        // Check for valid characters
        const validChars = /^[0-9+\-*/.() ]+$/;
        if (!validChars.test(expression)) {
            return false;
        }
        
        // Check for balanced parentheses
        let parenCount = 0;
        for (let char of expression) {
            if (char === '(') parenCount++;
            if (char === ')') parenCount--;
            if (parenCount < 0) return false;
        }
        
        return parenCount === 0;
    }
    
    evaluateExpression(expression) {
        // Safe evaluation without using eval()
        // This is a simplified parser for basic arithmetic
        
        // Remove spaces
        expression = expression.replace(/\s/g, '');
        
        // Simple recursive descent parser
        let index = 0;
        
        const parseNumber = () => {
            let num = '';
            while (index < expression.length && /[0-9.]/.test(expression[index])) {
                num += expression[index++];
            }
            return parseFloat(num);
        };
        
        const parseFactor = () => {
            if (expression[index] === '(') {
                index++; // skip '('
                const result = parseExpression();
                index++; // skip ')'
                return result;
            }
            
            if (expression[index] === '-') {
                index++; // skip '-'
                return -parseFactor();
            }
            
            if (expression[index] === '+') {
                index++; // skip '+'
                return parseFactor();
            }
            
            return parseNumber();
        };
        
        const parseTerm = () => {
            let result = parseFactor();
            
            while (index < expression.length && /[*/]/.test(expression[index])) {
                const operator = expression[index++];
                const operand = parseFactor();
                
                if (operator === '*') {
                    result *= operand;
                } else {
                    if (operand === 0) {
                        throw new Error('Division by zero');
                    }
                    result /= operand;
                }
            }
            
            return result;
        };
        
        const parseExpression = () => {
            let result = parseTerm();
            
            while (index < expression.length && /[+-]/.test(expression[index])) {
                const operator = expression[index++];
                const operand = parseTerm();
                
                if (operator === '+') {
                    result += operand;
                } else {
                    result -= operand;
                }
            }
            
            return result;
        };
        
        return parseExpression();
    }
    
    addToHistory(expression, result) {
        const historyItem = {
            expression: expression,
            result: result,
            timestamp: new Date().toLocaleString()
        };
        
        this.history.unshift(historyItem);
        
        // Keep only last 10 calculations
        if (this.history.length > 10) {
            this.history = this.history.slice(0, 10);
        }
        
        this.saveHistory();
        this.updateHistoryDisplay();
    }
    
    updateHistoryDisplay() {
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        
        this.history.forEach((item, index) => {
            const historyDiv = document.createElement('div');
            historyDiv.className = 'history-item';
            historyDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${item.expression} = ${item.result}</span>
                    <button onclick="calculator.useHistoryResult(${index})" 
                            style="background: #667eea; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 0.8em;">
                        Use
                    </button>
                </div>
                <small style="color: #666;">${item.timestamp}</small>
            `;
            historyList.appendChild(historyDiv);
        });
    }
    
    useHistoryResult(index) {
        const result = this.history[index].result;
        this.display.value = result.toString();
        this.shouldResetDisplay = true;
    }
    
    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.updateHistoryDisplay();
    }
    
    saveHistory() {
        localStorage.setItem('cortex-calculator-history', JSON.stringify(this.history));
    }
    
    loadHistory() {
        const saved = localStorage.getItem('cortex-calculator-history');
        if (saved) {
            this.history = JSON.parse(saved);
            this.updateHistoryDisplay();
        }
    }
    
    // Advanced mathematical functions (for future expansion)
    sqrt(x) {
        return Math.sqrt(x);
    }
    
    power(base, exponent) {
        return Math.pow(base, exponent);
    }
    
    sin(x) {
        return Math.sin(x);
    }
    
    cos(x) {
        return Math.cos(x);
    }
    
    tan(x) {
        return Math.tan(x);
    }
    
    log(x) {
        return Math.log10(x);
    }
    
    ln(x) {
        return Math.log(x);
    }
}

// Global functions for button clicks
let calculator;

function appendToDisplay(value) {
    calculator.appendToDisplay(value);
}

function clearDisplay() {
    calculator.clearDisplay();
}

function deleteLast() {
    calculator.deleteLast();
}

function calculate() {
    calculator.calculate();
}

function clearHistory() {
    calculator.clearHistory();
}

// Initialize calculator when page loads
document.addEventListener('DOMContentLoaded', () => {
    calculator = new CortexCalculator();
    console.log('CortexWeaver Calculator initialized successfully!');
    console.log('Features: Basic arithmetic, keyboard support, calculation history');
});