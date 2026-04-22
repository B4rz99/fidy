import { HomeScreenContent } from "./home-screen/HomeScreenContent";
import { useHomeScreen } from "./home-screen/useHomeScreen";

export const HomeScreen = () => {
  const model = useHomeScreen();

  return <HomeScreenContent model={model} />;
};
