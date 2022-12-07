import { ContractReceipt } from 'ethers';

export const getEventFromTxReceipt = <T>(receipt: ContractReceipt, index = 0): T => {
  return receipt.events?.at(index)?.args as unknown as T;
};
