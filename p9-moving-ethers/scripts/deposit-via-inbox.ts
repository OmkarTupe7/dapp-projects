import { utils, providers, Wallet } from "ethers";
import { Inbox__factory, Bridge } from "arb-ts";
const { parseEther } = utils;

const RINKEBY_RPC = process.env.RINKEBY_RPC as string;
const ARBITRUM_TESTNET_RPC = process.env.ARBITRUM_TESTNET_RPC as string;
const DEVNET_PRIVKEY = process.env.DEVNET_PRIVKEY as string;
const INBOX_ADDR = process.env.INBOX_ADDR as string;

/**
 * Set up: instantiate L1 / L2 wallets connected to providers
 */
const l1Provider = new providers.JsonRpcProvider(RINKEBY_RPC);
const l2Provider = new providers.JsonRpcProvider(ARBITRUM_TESTNET_RPC);
const l1Wallet = new Wallet(DEVNET_PRIVKEY, l1Provider);
const l2Wallet = new Wallet(DEVNET_PRIVKEY, l2Provider);

/**
 * Set the amount to be depositted in L2 (in wei)
 */
const ethToL2DepositAmount = parseEther("0.0001");

async function main() {
  console.log("('Deposit Eth via the Inbox')");
  /**
   * Use wallets to create an arb-ts bridge instance
   * We'll use bridge for its convenience methods around checking txn statuses and ETH balances
   */
  const bridge = await Bridge.init(l1Wallet, l2Wallet);

  /**
   * First, let's check the l2Wallet initial ETH balance (before our deposit)
   */
  const l2WalletInitialEthBalance = await bridge.getL2EthBalance();

  /**
   * To transfer ETH to L2 directly through the Inbox, we first create an instance of this contract
   */
  const inbox = Inbox__factory.connect(INBOX_ADDR, l1Wallet);

  /**
   * Call the depositEth() function from the Inbox contract
   * Pass the MaxSubmissionCost as argument: amount of ETH allocated to pay for the base submission fee (we hard code a large value). The value is the amount to forwarded as an L2 deposit
   * Note that depositEth creates a retryable with l2 gas price and l2 gas limit set to zero; we're only using the retryable mechanism to forward the callvalue to our destination
   */
  const depositTx = await inbox.depositEth(10000000000000, {
    value: ethToL2DepositAmount,
  });
  const rec = await depositTx.wait();
  console.warn("Deposit L1 receipt is:", rec.transactionHash);

  /**
   * With the transaction confirmed on L1, we now wait and check for the L2 side (i.e., balance credited to L2) to be confirmed as well.
   * First, we get our txn's sequence number from the event logs (using a handy utility method)
   * This sequence number uniquely identifies our L1-to-L2 message:
   */
  const seqNumArr = await bridge.getInboxSeqNumFromContractTransaction(rec);
  if (seqNumArr === undefined) {
    throw new Error("No seq num");
  }
  console.log("Inbox sequence number is found!");
  /**
   * Note that a single txn could (in theory) trigger many l1-to-l2 messages; we know ours only triggered 1 tho.
   */
  const seqNum = seqNumArr[0];

  /**
   * Using the sequence number, we can deterministically predict what its corresponding L2 txn will be
   */
  const l2TxHash = await bridge.calculateL2TransactionHash(seqNum);
  console.warn("L2 Tx Hash is", l2TxHash);

  /**
   * ... and now we wait. Here we're waiting for the Sequencer to include the L2 message in its off-chain queue. The Sequencer should include it in under 10 minutes.
   */
  console.log("Waiting for L2 tx...");
  const l2TxRec = await l2Provider.waitForTransaction(
    l2TxHash,
    undefined,
    1000 * 60 * 12
  );
  console.log("L2 tx found:", l2TxRec.transactionHash);

  /**
   * Our L2 balance should now be updated!
   */
  const l2WalletUpdatedEthBalance = await bridge.getL2EthBalance();
  console.log(
    `Your L2 balance is updated from ${l2WalletInitialEthBalance.toString()} to ${l2WalletUpdatedEthBalance.toString()}`
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
