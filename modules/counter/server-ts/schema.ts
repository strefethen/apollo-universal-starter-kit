import gql from 'graphql-tag';

export default gql`
  # Database counter
  type Counter {
    # Current amount
    amount: Int!
  }

  extend type Query {
    # Counter
    serverCounter: Counter
  }

  extend type Mutation {
    # Increase counter value, returns current counter amount
    addServerCounter(
      # Amount to add to counter
      amount: Int!
    ): Counter
  }

  extend type Subscription {
    # Subscription fired when anyone increases counter
    counterUpdated: Counter
  }
`;
