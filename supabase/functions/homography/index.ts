// Homography Edge Function for Soccer Video Analysis

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Matrix multiplication helper
function matMul(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;
  const result: number[][] = [];

  for (let i = 0; i < rowsA; i++) {
    result[i] = [];
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += A[i][k] * B[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

// Matrix transpose
function transpose(A: number[][]): number[][] {
  return A[0].map((_, colIndex) => A.map(row => row[colIndex]));
}

// Solve linear system using Gaussian elimination with partial pivoting
function gaussianElimination(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    // Eliminate
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}

// Compute homography using Direct Linear Transform (DLT)
function computeHomography(
  videoPoints: number[][],
  pitchPoints: number[][]
): { matrix: number[][]; error: number } {
  const n = videoPoints.length;
  if (n < 4) throw new Error("At least 4 points required");

  // Normalize points for numerical stability
  const normalizePoints = (points: number[][]) => {
    const meanX = points.reduce((s, p) => s + p[0], 0) / n;
    const meanY = points.reduce((s, p) => s + p[1], 0) / n;
    const scale = Math.sqrt(2) / Math.sqrt(
      points.reduce((s, p) => s + (p[0] - meanX) ** 2 + (p[1] - meanY) ** 2, 0) / n
    );
    
    const normalized = points.map(p => [
      (p[0] - meanX) * scale,
      (p[1] - meanY) * scale
    ]);
    
    const T = [
      [scale, 0, -meanX * scale],
      [0, scale, -meanY * scale],
      [0, 0, 1]
    ];
    
    return { normalized, T, invT: [
      [1/scale, 0, meanX],
      [0, 1/scale, meanY],
      [0, 0, 1]
    ]};
  };

  const srcNorm = normalizePoints(videoPoints);
  const dstNorm = normalizePoints(pitchPoints);

  // Build the DLT matrix A
  const A: number[][] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = srcNorm.normalized[i];
    const [xp, yp] = dstNorm.normalized[i];
    
    A.push([-x, -y, -1, 0, 0, 0, x * xp, y * xp, xp]);
    A.push([0, 0, 0, -x, -y, -1, x * yp, y * yp, yp]);
  }

  // Solve using SVD approximation (least squares via normal equations)
  const AtA = matMul(transpose(A), A);
  
  // Find the eigenvector corresponding to smallest eigenvalue using power iteration
  // on inverse (we want smallest, so we invert)
  let h = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  
  // Use least squares: minimize ||Ah|| subject to ||h|| = 1
  // This is approximated by solving (A^T A) h = 0 with constraint
  // We use the constraint h[8] = 1 and solve the reduced system
  
  const Areduced: number[][] = [];
  const breduced: number[] = [];
  
  for (let i = 0; i < A.length; i++) {
    Areduced.push(A[i].slice(0, 8));
    breduced.push(-A[i][8]);
  }
  
  // Solve overdetermined system using normal equations
  const AtAr = matMul(transpose(Areduced), Areduced);
  const Atb = transpose(Areduced).map((row, i) => 
    row.reduce((sum, val, j) => sum + val * breduced[j], 0)
  );
  
  const hReduced = gaussianElimination(AtAr, Atb);
  h = [...hReduced, 1];

  // Reshape to 3x3
  const Hnorm: number[][] = [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], h[8]]
  ];

  // Denormalize: H = T'^(-1) * Hnorm * T
  const H = matMul(matMul(dstNorm.invT, Hnorm), srcNorm.T);
  
  // Normalize so H[2][2] = 1
  const scale = H[2][2];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      H[i][j] /= scale;
    }
  }

  // Calculate reprojection error
  let totalError = 0;
  for (let i = 0; i < n; i++) {
    const [x, y] = videoPoints[i];
    const w = H[2][0] * x + H[2][1] * y + H[2][2];
    const projX = (H[0][0] * x + H[0][1] * y + H[0][2]) / w;
    const projY = (H[1][0] * x + H[1][1] * y + H[1][2]) / w;
    
    totalError += (projX - pitchPoints[i][0]) ** 2 + (projY - pitchPoints[i][1]) ** 2;
  }
  const error = Math.sqrt(totalError / n);

  return { matrix: H, error };
}

// Transform a point using homography
function transformPoint(point: number[], H: number[][]): number[] {
  const [x, y] = point;
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  return [
    (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
    (H[1][0] * x + H[1][1] * y + H[1][2]) / w
  ];
}

// Calculate distance between two pitch points
function calculateDistance(p1: number[], p2: number[]): number {
  return Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "calibrate";
    const body = await req.json();

    console.log(`Homography API called with action: ${action}`);

    let result;

    switch (action) {
      case "calibrate": {
        const { video_points, pitch_points } = body;
        
        if (!video_points || !pitch_points) {
          throw new Error("video_points and pitch_points are required");
        }
        if (video_points.length < 4 || pitch_points.length < 4) {
          throw new Error("At least 4 calibration points are required");
        }
        if (video_points.length !== pitch_points.length) {
          throw new Error("Number of video and pitch points must match");
        }

        const { matrix, error } = computeHomography(video_points, pitch_points);
        
        result = {
          success: true,
          matrix,
          reprojection_error: Math.round(error * 100) / 100,
          message: `Calibration successful with ${video_points.length} points. Error: ${error.toFixed(2)}m`
        };
        break;
      }

      case "transform": {
        const { video_point, matrix } = body;
        
        if (!video_point || !matrix) {
          throw new Error("video_point and matrix are required");
        }

        const pitchPoint = transformPoint(video_point, matrix);
        
        result = {
          success: true,
          pitch_point: pitchPoint
        };
        break;
      }

      case "distance": {
        const { point1, point2, matrix } = body;
        
        if (!point1 || !point2 || !matrix) {
          throw new Error("point1, point2, and matrix are required");
        }

        const pitchPoint1 = transformPoint(point1, matrix);
        const pitchPoint2 = transformPoint(point2, matrix);
        const distance = calculateDistance(pitchPoint1, pitchPoint2);
        
        result = {
          success: true,
          distance: Math.round(distance * 10) / 10,
          pitch_point1: pitchPoint1,
          pitch_point2: pitchPoint2
        };
        break;
      }

      case "batch_transform": {
        const { video_points, matrix } = body;
        
        if (!video_points || !matrix) {
          throw new Error("video_points and matrix are required");
        }

        const pitchPoints = video_points.map((p: number[]) => transformPoint(p, matrix));
        
        result = {
          success: true,
          pitch_points: pitchPoints
        };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Homography result:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Homography error:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
