// 🧠 HELPER: Levenshtein Distance for Fuzzy Matching
const levenshteinDistance = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
    }
    return matrix[b.length][a.length];
};

// 🧠 HELPER: Find Best Match
const findBestMatch = (target, list, key = null) => {
    let bestMatch = null;
    let minDistance = Infinity;
    target = target.toLowerCase();

    for (const item of list) {
        const value = (key ? item[key] : item).toLowerCase();
        if (value.includes(target)) return item; // Direct substring match is priority

        const dist = levenshteinDistance(target, value);
        if (dist < minDistance && dist <= 3) { // Tolerance of 3 chars
            minDistance = dist;
            bestMatch = item;
        }
    }
    return bestMatch;
};

module.exports = { levenshteinDistance, findBestMatch };
