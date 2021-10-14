// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract DataFeedConsumer {
  AggregatorV3Interface internal priceFeed;

  /**
   * Network: Rinkeby
   * Aggregator: BTC/USD
   * Address: 0xECe365B379E1dD183B20fc5f022230C044d51404
   */
  constructor() {
    priceFeed = AggregatorV3Interface(0xECe365B379E1dD183B20fc5f022230C044d51404);
  }

  /**
   * Returns the latest price.
   */
  function getLatestPrice()
    public view returns (uint80 roundID, int256 price, uint256 startedAt, uint256 timestamp, uint80 answeredInRound)
  {
    (roundID, price, startedAt, timestamp, answeredInRound) = priceFeed.latestRoundData();
  }

  /**
   * Returns historical price for a round id.
   * roundId is NOT incremental. Not all roundIds are valid.
   * You must know a valid roundId before consuming historical data.
   * @dev A timestamp with zero value means the round is not complete and should not be used.
   */
  function getHistoricalPrice(uint80 _roundId)
    public view returns (uint80 roundID, int256 price, uint256 startedAt, uint256 timestamp, uint80 answeredInRound)
  {
    (roundID, price, startedAt, timestamp, answeredInRound) = priceFeed.getRoundData(_roundId);
    require(timestamp > 0, "Round not completed!");
  }
}