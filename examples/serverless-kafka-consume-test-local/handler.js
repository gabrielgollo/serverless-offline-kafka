exports.hello = async () => {
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Go Serverless v4! Your function executed successfully!",
    }),
  };
};


exports.kafkaHandler = async (event) => {
  console.log("Received Kafka event:", event);
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Kafka event processed successfully!",
    }),
  };
}