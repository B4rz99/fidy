import { useRouter } from "expo-router";
import { SearchScreenContent } from "./search-screen/SearchScreenContent";
import { useSearchScreen } from "./search-screen/useSearchScreen";

export const SearchScreen = () => {
  const { back } = useRouter();
  const viewModel = useSearchScreen();

  return <SearchScreenContent {...viewModel} onBack={back} />;
};
