import { SoccerAnalyzer } from '@/components/soccer/SoccerAnalyzer';

const Index = () => {
  // Configure your Python backend URL here (optional)
  // If not provided, the app will use client-side homography calculations
  const pythonApiEndpoint = import.meta.env.VITE_PYTHON_API_ENDPOINT;

  return <SoccerAnalyzer pythonApiEndpoint={pythonApiEndpoint} />;
};

export default Index;
