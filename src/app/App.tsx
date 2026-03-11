import { useComparisonStore } from "@/stores/comparison-store";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import Layout from "./Layout";
import HomeView from "@/features/home/components/HomeView";
import TextCompareView from "@/features/text-compare/components/TextCompareView";
import DirCompareView from "@/features/dir-compare/components/DirCompareView";
import BinaryCompareView from "@/features/binary-compare/components/BinaryCompareView";

function App() {
  const view = useComparisonStore((s) => s.view);
  useKeyboardShortcuts();

  const renderView = () => {
    switch (view) {
      case "home":
        return <HomeView />;
      case "dir-compare":
        return <DirCompareView />;
      case "text-compare":
        return <TextCompareView />;
      case "binary-compare":
        return <BinaryCompareView />;
    }
  };

  return <Layout>{renderView()}</Layout>;
}

export default App;
