export type Difficulty = "Easy" | "Medium" | "Hard";

interface ScoreParams {
  difficulty: Difficulty;
  passedTestCases: number;
  totalTestCases: number;
  wrongAttempts: number;
  elapsedMinutes: number;
}

export function calculateScore({
  difficulty,
  passedTestCases,
  totalTestCases,
  wrongAttempts,
  elapsedMinutes,
}: ScoreParams): number {
  const basePointsMap = {
    Easy: 100,
    Medium: 200,
    Hard: 300,
  };

  const timeLimitMap = {
    Easy: 20,
    Medium: 40,
    Hard: 90,
  };

  const deductionRateMap = {
    Easy: 15,
    Medium: 20,
    Hard: 20,
  };

  const basePoints = basePointsMap[difficulty];
  const timeLimit = timeLimitMap[difficulty];
  const deductionRate = deductionRateMap[difficulty];

  let score = basePoints * (passedTestCases / totalTestCases);

  if (elapsedMinutes <= 5) score += 50;
  else if (elapsedMinutes <= 10) score += 30;
  else if (elapsedMinutes <= 15) score += 10;

  score -= Math.min(wrongAttempts * 10, 50);

  const deductionStartTime = timeLimit / 2;
  if (elapsedMinutes > deductionStartTime) {
    const extraIntervals = Math.floor((elapsedMinutes - deductionStartTime) / 10);
    score -= extraIntervals * deductionRate;
  }

  return Math.max(Math.floor(score), 0);
}
