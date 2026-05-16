(function () {
  const sim = window.AttentionSinkSim;
  const results = document.getElementById("results");

  function writeResult(name, passed, detail) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<div class="${passed ? "pass" : "fail"}">${passed ? "PASS" : "FAIL"} - ${name}</div><p>${detail}</p>`;
    results.appendChild(card);
  }

  function assert(condition, name, detail) {
    if (!condition) {
      throw new Error(`${name}: ${detail}`);
    }
    writeResult(name, true, detail);
  }

  function run() {
    const attention = sim.core.attentionGenerator.generateAttentionTensor({
      layers: 6,
      heads: 8,
      sequenceLength: 64,
      sinkTokenIds: [0, 1, 2, 3],
      sinkStrength: 0.4,
      localWindow: 12,
      retrievalSpikeProbability: 0.1,
      seed: 42,
    });

    assert(attention.validation.valid, "attention tensor validation", "Generated tensor passes row-sum and causal-mask validation.");

    const manualRow = attention.tensor[0][0][10];
    const manualRowSum = manualRow.reduce((sum, value) => sum + value, 0);
    assert(Math.abs(manualRowSum - 1) < 1e-6, "attention rows sum to 1", `Observed row sum ${manualRowSum}.`);

    const causalOkay = manualRow.slice(11).every((value) => Math.abs(value) < 1e-9);
    assert(causalOkay, "causal mask respected", "Keys beyond the query index are zero.");

    const sinkScores = sim.core.sinkScore.computeSinkScores(attention.tensor, { threshold: 0.55 });
    const topFive = sinkScores.rankedTokens.slice(0, 5).map((entry) => entry.tokenId);
    assert(topFive.some((tokenId) => tokenId <= 3), "sink tokens rank near top", `Top tokens were ${topFive.join(", ")}.`);

    let manualScore = 0;
    for (let layer = 0; layer < attention.tensor.length; layer += 1) {
      for (let head = 0; head < attention.tensor[layer].length; head += 1) {
        for (let query = 0; query < attention.tensor[layer][head].length; query += 1) {
          manualScore += attention.tensor[layer][head][query][0];
        }
      }
    }
    assert(Math.abs(manualScore - sinkScores.scores[0]) < 1e-9, "sink score matches manual sum", `manual=${manualScore}, computed=${sinkScores.scores[0]}`);

    const Q = [0.2, -0.4, 0.7, 0.5];
    const K = [
      [0.1, -0.5, 0.3, 0.2],
      [0.3, 0.1, -0.2, 0.7],
      [-0.6, 0.2, 0.4, 0.1],
      [0.8, -0.1, 0.3, -0.3],
      [0.5, 0.5, -0.6, 0.4],
    ];
    const V = [
      [0.2, 0.1, -0.3],
      [-0.2, 0.4, 0.8],
      [0.9, -0.1, 0.2],
      [0.5, 0.6, -0.4],
      [-0.3, 0.7, 0.1],
    ];
    const merge = sim.core.merge.verifyMergeAgainstFullAttention(Q, K, V, [[0, 1], [2, 3, 4]]);
    assert(merge.passed, "split merge equals full attention", `maxAbsError=${merge.maxAbsError}, meanAbsError=${merge.meanAbsError}`);

    const invalidTensor = JSON.parse(JSON.stringify(attention.tensor));
    invalidTensor[0][0][4][6] = 0.1;
    const invalidValidation = sim.core.attentionGenerator.validateAttentionTensor(invalidTensor);
    assert(!invalidValidation.valid, "invalid tensor detected", "Validation catches causal-mask violations.");
  }

  try {
    run();
  } catch (error) {
    writeResult("core algorithms", false, error.message);
    throw error;
  }
})();
