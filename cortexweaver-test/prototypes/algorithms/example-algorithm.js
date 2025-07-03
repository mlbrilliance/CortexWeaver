/**
 * Example Algorithm Prototype
 * 
 * This is a template for algorithm prototyping and testing.
 * Replace this example sorting algorithm with your own implementation.
 */

/**
 * Example sorting algorithm implementation
 * @param {number[]} arr - Array of numbers to sort
 * @returns {number[]} - Sorted array
 */
function exampleSort(arr) {
  // Replace with your algorithm implementation
  return [...arr].sort((a, b) => a - b);
}

/**
 * Performance testing function
 * @param {Function} algorithm - Algorithm function to test
 * @param {Array} testData - Test data array
 * @returns {Object} - Performance results
 */
function performanceTest(algorithm, testData) {
  const start = process.hrtime.bigint();
  const result = algorithm([...testData]);
  const end = process.hrtime.bigint();
  
  const executionTime = Number(end - start) / 1000000; // Convert to milliseconds
  
  return {
    result,
    executionTimeMs: executionTime,
    isCorrect: isSorted(result)
  };
}

/**
 * Verify if array is sorted correctly
 * @param {number[]} arr - Array to check
 * @returns {boolean} - True if sorted
 */
function isSorted(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Run test cases
 */
function runTests() {
  const testCases = [
    [3, 1, 4, 1, 5, 9, 2, 6],
    [1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1],
    [1],
    [],
    Array.from({length: 1000}, () => Math.floor(Math.random() * 1000))
  ];

  console.log('Running algorithm tests...');
  
  testCases.forEach((testCase, index) => {
    const result = performanceTest(exampleSort, testCase);
    console.log(`Test ${index + 1}: ${result.isCorrect ? 'PASS' : 'FAIL'} (${result.executionTimeMs.toFixed(3)}ms)`);
  });
}

// Export for testing
module.exports = {
  exampleSort,
  performanceTest,
  runTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}