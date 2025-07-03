/**
 * CortexWeaver Calculator - Advanced Mathematical Calculator
 * Created by AI Agent Orchestration:
 * - Architect Agent: System design and architecture
 * - Coder Agent: Implementation and logic
 * - Chicago-Tester Agent: Unit testing and validation
 * - London-Tester Agent: Integration testing
 * - Debugger Agent: Bug fixes and error handling
 * - Performance-Optimizer Agent: Performance optimizations
 * - Quality-Gatekeeper Agent: Quality assurance and review
 */

class CortexCalculator {
    constructor() {
        console.log('🤖 CortexCalculator initialized by AI Agent Orchestration');
        
        this.display = document.getElementById('display');
        this.historyList = document.getElementById('history-list');
        this.history = [];
        this.currentInput = '';
        this.operator = null;
        this.previousInput = '';
        this.shouldResetDisplay = false;
        this.maxHistoryItems = 10;
        
        // Performance optimization: Cache DOM elements
        this.cachedElements = {
            display: this.display,
            historyList: this.historyList
        };
        
        this.loadHistory();
        this.initializeEventListeners();
        this.initializeKeyboardSupport();
        
        // Agent coordination: Log initialization to cognitive canvas
        this.logToCanvas('Calculator initialized', 'initialization');
    }
    
    /**
     * Initialize keyboard event listeners (Coder Agent implementation)
     */
    initializeEventListeners() {
        // Keyboard support for accessibility
        document.addEventListener('keydown', this.handleKeyboardInput.bind(this));
        
        // Display input validation
        this.display.addEventListener('input', this.validateDisplayInput.bind(this));
        
        console.log('📝 Event listeners initialized by Coder Agent');
    }
    
    /**
     * Enhanced keyboard support (Performance-Optimizer improvement)
     */
    initializeKeyboardSupport() {
        const keyMap = {
            '0': () => this.appendToDisplay('0'),
            '1': () => this.appendToDisplay('1'),
            '2': () => this.appendToDisplay('2'),
            '3': () => this.appendToDisplay('3'),
            '4': () => this.appendToDisplay('4'),
            '5': () => this.appendToDisplay('5'),
            '6': () => this.appendToDisplay('6'),
            '7': () => this.appendToDisplay('7'),
            '8': () => this.appendToDisplay('8'),
            '9': () => this.appendToDisplay('9'),
            '.': () => this.appendToDisplay('.'),
            '+': () => this.appendToDisplay('+'),
            '-': () => this.appendToDisplay('-'),
            '*': () => this.appendToDisplay('*'),
            '/': () => this.appendToDisplay('/'),
            'Enter': () => this.calculate(),
            '=': () => this.calculate(),
            'Escape': () => this.clearDisplay(),
            'c': () => this.clearDisplay(),
            'C': () => this.clearDisplay(),
            'Backspace': () => this.deleteLast()
        };
        
        this.keyMap = keyMap;
    }
    
    /**
     * Handle keyboard input (Debugger Agent enhancement)
     */
    handleKeyboardInput(event) {
        try {
            // Prevent default for calculator keys
            const calculatorKeys = ['Enter', 'Escape', 'Backspace'];
            if (calculatorKeys.includes(event.key) || /[0-9+\-*/.=cC]/.test(event.key)) {
                event.preventDefault();
            }
            
            const handler = this.keyMap[event.key];
            if (handler) {
                handler();
                this.logToCanvas(`Keyboard input: ${event.key}`, 'user_interaction');
            }
        } catch (error) {
            this.handleError('Keyboard input error', error);
        }
    }
    
    /**
     * Validate display input (Quality-Gatekeeper implementation)
     */
    validateDisplayInput(event) {
        const validChars = /^[0-9+\-*/.() ]*$/;
        if (!validChars.test(event.target.value)) {
            event.target.value = event.target.value.replace(/[^0-9+\-*/.() ]/g, '');
        }
    }
    
    /**
     * Append value to display (Coder Agent with Debugger improvements)
     */
    appendToDisplay(value) {
        try {
            if (this.shouldResetDisplay) {
                this.display.value = '';
                this.shouldResetDisplay = false;
            }
            
            const currentDisplay = this.display.value;
            
            // Handle operators with enhanced logic
            if (['+', '-', '*', '/'].includes(value)) {
                if (currentDisplay === '' && value === '-') {
                    this.display.value = '-';
                    return;
                }
                
                // Replace × with * for internal calculation
                const displayValue = value === '*' ? '×' : value;
                
                if (currentDisplay !== '' && !['+', '-', '×', '/'].includes(currentDisplay.slice(-1))) {
                    this.display.value += ` ${displayValue} `;
                }
                return;
            }
            
            // Handle decimal point validation (Quality-Gatekeeper enhancement)
            if (value === '.') {
                const parts = currentDisplay.split(/[\+\-\×\/]/);
                const lastPart = parts[parts.length - 1].trim();
                if (lastPart.includes('.')) {
                    return; // Prevent multiple decimal points
                }
            }
            
            this.display.value += value;
            this.logToCanvas(`Display updated: ${value}`, 'user_interaction');
            
        } catch (error) {
            this.handleError('Display append error', error);
        }
    }
    
    /**
     * Clear display (Coder Agent implementation)
     */
    clearDisplay() {
        this.display.value = '';
        this.currentInput = '';
        this.operator = null;
        this.previousInput = '';
        this.shouldResetDisplay = false;
        this.logToCanvas('Display cleared', 'user_interaction');
    }
    
    /**
     * Delete last character (Coder Agent with Performance optimization)
     */
    deleteLast() {
        let currentValue = this.display.value;
        if (currentValue.length > 0) {
            // Optimized string manipulation
            if (currentValue.endsWith(' ')) {
                // Remove operator and surrounding spaces
                currentValue = currentValue.trim().slice(0, -1).trim();
            } else {
                currentValue = currentValue.slice(0, -1);
            }
            this.display.value = currentValue;
            this.logToCanvas('Character deleted', 'user_interaction');
        }
    }
    
    /**
     * Perform calculation (Architect design, Coder implementation, Debugger error handling)
     */
    calculate() {
        const expression = this.display.value.trim();
        if (!expression) return;
        
        try {
            console.log('🧮 Calculating expression:', expression);
            
            // Validate expression (Quality-Gatekeeper requirement)
            if (!this.isValidExpression(expression)) {
                throw new Error('Invalid expression');
            }
            
            // Replace display operators with JavaScript operators
            let jsExpression = expression
                .replace(/×/g, '*')
                .replace(/÷/g, '/');
            
            // Safe calculation using custom parser (Security enhancement by Debugger)
            const result = this.evaluateExpression(jsExpression);
            
            // Handle special cases (Debugger Agent improvements)
            if (!isFinite(result)) {
                throw new Error('Mathematical error - infinite or undefined result');
            }
            
            if (isNaN(result)) {
                throw new Error('Mathematical error - not a number');
            }
            
            // Performance optimization: Round to avoid floating point precision issues
            const roundedResult = Math.round(result * 1000000000000) / 1000000000000;
            
            // Add to history (Feature by Architect, implemented by Coder)
            this.addToHistory(expression, roundedResult);
            
            // Update display
            this.display.value = roundedResult.toString();
            this.shouldResetDisplay = true;
            
            this.logToCanvas(`Calculation completed: ${expression} = ${roundedResult}`, 'calculation');
            
        } catch (error) {
            this.handleError('Calculation error', error);
            this.display.value = 'Error';
            this.shouldResetDisplay = true;
        }
    }
    
    /**
     * Validate mathematical expression (Quality-Gatekeeper implementation)
     */
    isValidExpression(expression) {
        // Check for valid characters only
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
        
        // Check for consecutive operators
        if (/[\+\-\*\/]{2,}/.test(expression.replace(/\s/g, ''))) {
            return false;
        }
        
        return parenCount === 0;
    }
    
    /**
     * Safe expression evaluation (Security implementation by Debugger Agent)
     * Uses recursive descent parser instead of eval() for security
     */
    evaluateExpression(expression) {
        // Remove all spaces for easier parsing
        expression = expression.replace(/\s/g, '');
        
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
    
    /**
     * Add calculation to history (Feature designed by Architect, implemented by Coder)
     */
    addToHistory(expression, result) {
        const historyItem = {
            expression: expression,
            result: result,
            timestamp: new Date().toLocaleString(),
            id: Date.now()
        };
        
        // Add to beginning of array (most recent first)
        this.history.unshift(historyItem);
        
        // Limit history size (Performance optimization)
        if (this.history.length > this.maxHistoryItems) {
            this.history = this.history.slice(0, this.maxHistoryItems);
        }
        
        this.saveHistory();
        this.updateHistoryDisplay();
        
        console.log('📊 History updated by Coder Agent');
    }
    
    /**
     * Update history display (UI implementation by Coder Agent)
     */
    updateHistoryDisplay() {
        this.historyList.innerHTML = '';
        
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">No calculations yet</div>';
            return;
        }
        
        this.history.forEach((item, index) => {
            const historyDiv = document.createElement('div');
            historyDiv.className = 'history-item';
            historyDiv.innerHTML = `
                <div>
                    <div>${item.expression} = ${item.result}</div>
                    <small style="opacity: 0.7;">${item.timestamp}</small>
                </div>
                <button class="use-btn" onclick="calculator.useHistoryResult(${index})">
                    Use
                </button>
            `;
            this.historyList.appendChild(historyDiv);
        });
    }
    
    /**
     * Use result from history (Feature by Architect, implemented by Coder)
     */
    useHistoryResult(index) {
        if (this.history[index]) {
            const result = this.history[index].result;
            this.display.value = result.toString();
            this.shouldResetDisplay = true;
            this.logToCanvas(`History result used: ${result}`, 'user_interaction');
        }
    }
    
    /**
     * Clear calculation history (Feature by Coder Agent)
     */
    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.updateHistoryDisplay();
        this.logToCanvas('History cleared', 'user_interaction');
        console.log('🗑️ History cleared by user action');
    }
    
    /**
     * Save history to localStorage (Persistence by Coder Agent)
     */
    saveHistory() {
        try {
            localStorage.setItem('cortex-calculator-history', JSON.stringify(this.history));
        } catch (error) {
            console.warn('Could not save history to localStorage:', error);
        }
    }
    
    /**
     * Load history from localStorage (Persistence by Coder Agent)
     */
    loadHistory() {
        try {
            const saved = localStorage.getItem('cortex-calculator-history');
            if (saved) {
                this.history = JSON.parse(saved);
                this.updateHistoryDisplay();
                console.log('📂 History loaded from localStorage');
            }
        } catch (error) {
            console.warn('Could not load history from localStorage:', error);
            this.history = [];
        }
    }
    
    /**
     * Error handling (Implemented by Debugger Agent)
     */
    handleError(context, error) {
        const errorMessage = `${context}: ${error.message}`;
        console.error('❌ Calculator Error:', errorMessage);
        
        // Log to cognitive canvas for agent coordination
        this.logToCanvas(errorMessage, 'error');
        
        // User-friendly error display
        if (context.includes('Calculation')) {
            // Don't overwhelm user with technical details
            return;
        }
        
        // Log for debugging but don't show to user for non-calculation errors
        console.debug('Error details:', error);
    }
    
    /**
     * Log events to cognitive canvas (Agent Integration by Architect)
     */
    logToCanvas(message, type) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            agent: 'CortexCalculator',
            message: message,
            type: type
        };
        
        // In a real implementation, this would send to Neo4j cognitive canvas
        console.log('🧠 Cognitive Canvas Log:', logEntry);
    }
    
    /**
     * Advanced mathematical functions (Future expansion designed by Architect)
     */
    sqrt(x) {
        if (x < 0) throw new Error('Square root of negative number');
        return Math.sqrt(x);
    }
    
    power(base, exponent) {
        return Math.pow(base, exponent);
    }
    
    factorial(n) {
        if (n < 0) throw new Error('Factorial of negative number');
        if (n === 0 || n === 1) return 1;
        return n * this.factorial(n - 1);
    }
    
    // Trigonometric functions
    sin(x) { return Math.sin(x); }
    cos(x) { return Math.cos(x); }
    tan(x) { return Math.tan(x); }
    
    // Logarithmic functions
    log(x) { return Math.log10(x); }
    ln(x) { return Math.log(x); }
}

// Global functions for HTML button clicks (Required by HTML interface)
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

// Initialize calculator when DOM is ready (Coder Agent implementation)
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing CortexWeaver Calculator...');
    console.log('👥 Created by AI Agent Orchestration:');
    console.log('   🏗️  Architect Agent - System design');
    console.log('   💻 Coder Agent - Implementation');
    console.log('   🧪 Chicago-Tester - Unit testing');
    console.log('   🔗 London-Tester - Integration testing');
    console.log('   🐛 Debugger Agent - Error handling');
    console.log('   ⚡ Performance-Optimizer - Optimizations');
    console.log('   ✅ Quality-Gatekeeper - Quality assurance');
    
    calculator = new CortexCalculator();
    
    console.log('✅ Calculator successfully initialized by AI agent swarm!');
});