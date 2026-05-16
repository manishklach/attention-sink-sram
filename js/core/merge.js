(function () {
  const sim = (window.AttentionSinkSim = window.AttentionSinkSim || {});
  sim.core = sim.core || {};

  function dot(a, b) {
    let total = 0;
    for (let index = 0; index < a.length; index += 1) {
      total += a[index] * b[index];
    }
    return total;
  }

  function vectorScale(vector, scalar) {
    return vector.map((value) => value * scalar);
  }

  function vectorAdd(a, b) {
    return a.map((value, index) => value + b[index]);
  }

  function zeros(length) {
    return Array.from({ length }, () => 0);
  }

  function logSumExp(values) {
    const maxValue = Math.max(...values);
    const denom = values.reduce((total, value) => total + Math.exp(value - maxValue), 0);
    return maxValue + Math.log(denom);
  }

  function softmaxPartition(Q, K, V, indices) {
    const scale = Math.sqrt(Q.length);
    const scores = indices.map((index) => dot(Q, K[index]) / scale);
    const lse = logSumExp(scores);
    let output = zeros(V[0].length);
    scores.forEach((score, localIndex) => {
      const weight = Math.exp(score - lse);
      output = vectorAdd(output, vectorScale(V[indices[localIndex]], weight));
    });
    return {
      output,
      lse,
      indices: indices.slice(),
      scores,
    };
  }

  function fullAttention(Q, K, V) {
    const indices = Array.from({ length: K.length }, (_, index) => index);
    return softmaxPartition(Q, K, V, indices);
  }

  function mergeAttentionOutputs(partA, partB) {
    const m = Math.max(partA.lse, partB.lse);
    const weightA = Math.exp(partA.lse - m);
    const weightB = Math.exp(partB.lse - m);
    const denom = weightA + weightB;
    const mergedOutput = partA.output.map((value, index) => ((weightA * value) + (weightB * partB.output[index])) / denom);
    const mergedLSE = m + Math.log(denom);
    return {
      mergedOutput,
      mergedLSE,
    };
  }

  function mergeMultipleAttentionPartitions(parts) {
    return parts.reduce((accumulator, part) => {
      if (!accumulator) {
        return { mergedOutput: part.output.slice(), mergedLSE: part.lse };
      }
      return mergeAttentionOutputs(
        { output: accumulator.mergedOutput, lse: accumulator.mergedLSE },
        { output: part.output, lse: part.lse }
      );
    }, null);
  }

  function meanAbsError(a, b) {
    return a.reduce((total, value, index) => total + Math.abs(value - b[index]), 0) / Math.max(1, a.length);
  }

  function maxAbsError(a, b) {
    return a.reduce((maxValue, value, index) => Math.max(maxValue, Math.abs(value - b[index])), 0);
  }

  function verifyMergeAgainstFullAttention(Q, K, V, partitions) {
    const partitionResults = partitions.map((indices) => softmaxPartition(Q, K, V, indices));
    const merged = mergeMultipleAttentionPartitions(partitionResults);
    const reference = fullAttention(Q, K, V);
    const maxError = maxAbsError(merged.mergedOutput, reference.output);
    const meanError = meanAbsError(merged.mergedOutput, reference.output);

    return {
      mergedOutput: merged.mergedOutput,
      mergedLSE: merged.mergedLSE,
      referenceOutput: reference.output,
      referenceLSE: reference.lse,
      partitionResults,
      maxAbsError: maxError,
      meanAbsError: meanError,
      passed: maxError < 1e-9 && Math.abs(merged.mergedLSE - reference.lse) < 1e-9,
    };
  }

  sim.core.merge = {
    fullAttention,
    softmaxPartition,
    mergeAttentionOutputs,
    mergeMultipleAttentionPartitions,
    verifyMergeAgainstFullAttention,
  };
})();
