import NetInfo from "@react-native-community/netinfo";
import { Effect } from "effect";
import { type BoundAppService, fromPromise, makeAppService } from "./runtime";

export type AppNetwork = {
  readonly isOnline: () => Promise<boolean>;
};

export const liveAppNetwork: AppNetwork = {
  isOnline: async () => {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  },
};

export const AppNetworkService = makeAppService<AppNetwork>("@/shared/effect/AppNetwork");

export const isOnlineEffect = Effect.flatMap(AppNetworkService.tag, ({ isOnline }) =>
  fromPromise(isOnline)
);

export function bindAppNetwork(
  network: AppNetwork = liveAppNetwork
): BoundAppService<AppNetwork, AppNetwork> {
  return AppNetworkService.bind(network);
}
