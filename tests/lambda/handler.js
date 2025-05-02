module.exports.promise = (event) => {
    console.log(JSON.stringify(event));
    return Promise.resolve();
  };