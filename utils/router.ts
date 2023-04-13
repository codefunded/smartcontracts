import { BigNumber, ethers } from 'ethers';
import { PublicOrderWithIdStruct } from '../typechain-types/contracts/fundswap/FundSwap';

type PublicOrder = {
  [key in keyof PublicOrderWithIdStruct]: Awaited<
  PublicOrderWithIdStruct[key]
  > extends string
    ? string
    : BigNumber;
};

export type FillRequest = {
  sourceToken: string;
  destinationToken: string;
} & (
  | {
      type: 'EXACT_INPUT';
      sourceAmount: BigNumber;
    }
  | {
      type: 'EXACT_OUTPUT';
      destinationAmount: BigNumber;
    }
);

const calculatePrice = (order: PublicOrder) => {
  const price = order.amountWanted
    .mul(ethers.constants.WeiPerEther)
    .div(order.amountOffered);
  return price;
};

export const sortOrdersByPrice = (order1: PublicOrder, order2: PublicOrder) => {
  const price1 = calculatePrice(order1);
  const price2 = calculatePrice(order2);
  return price1.lt(price2) ? -1 : 1;
};

interface Path {
  route: PublicOrder[];
  amountRemainingToFill: BigNumber;
}

/**
 * Simple routing algorithm that returns the best trade route for a given fill request. It only supports
 * requests that have a single hop (i.e. sourceToken -> destinationToken, no intermediate tokens).
 * @param fillRequest The fill request to route
 * @param orders The orders to route through
 * @returns The best trade route for the given fill request or an empty array if no route exists. The route
 * is an array of order IDs.
 */
export const createTradeRoute = (fillRequest: FillRequest, orders: PublicOrder[]) => {
  if (fillRequest.type === 'EXACT_INPUT') {
    const { sourceToken, destinationToken, sourceAmount } = fillRequest;
    const ordersForPair = orders
      .filter(
        (order) =>
          order.offeredToken === destinationToken && order.wantedToken === sourceToken,
      )
      .sort(sortOrdersByPrice);
    if (ordersForPair.length === 0) {
      return [];
    }

    const path = ordersForPair.reduce<Path>(
      (acc, order) => {
        if (acc.amountRemainingToFill.isZero()) {
          return acc;
        }

        if (acc.amountRemainingToFill.lt(order.amountWanted)) {
          return {
            route: [...acc.route, order],
            amountRemainingToFill: BigNumber.from(0),
          };
        }

        return {
          route: [...acc.route, order],
          amountRemainingToFill: acc.amountRemainingToFill.sub(order.amountWanted),
        };
      },
      {
        route: [],
        amountRemainingToFill: sourceAmount,
      },
    );

    if (path.amountRemainingToFill.gt(0)) {
      throw new Error('Not enough liquidity to fill the request');
    }

    return path.route.map((order) => order.orderId);
  } else {
    const { sourceToken, destinationToken, destinationAmount } = fillRequest;
    const ordersForPair = orders
      .filter(
        (order) =>
          order.offeredToken === destinationToken && order.wantedToken === sourceToken,
      )
      .sort(sortOrdersByPrice);
    if (ordersForPair.length === 0) {
      return [];
    }

    const path = ordersForPair.reduce<Path>(
      (acc, order) => {
        if (acc.amountRemainingToFill.isZero()) {
          return acc;
        }

        if (acc.amountRemainingToFill.lt(order.amountOffered)) {
          return {
            route: [...acc.route, order],
            amountRemainingToFill: BigNumber.from(0),
          };
        }

        return {
          route: [...acc.route, order],
          amountRemainingToFill: acc.amountRemainingToFill.sub(order.amountOffered),
        };
      },
      {
        route: [],
        amountRemainingToFill: destinationAmount,
      },
    );

    if (path.amountRemainingToFill.gt(0)) {
      throw new Error('Not enough liquidity to fill the request');
    }

    return path.route.map((order) => order.orderId);
  }
};
