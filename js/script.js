module.exports = ({
  github,
  context,
  triggeredByAnotherApp,
  humanTriggered,
  featureBranchName,
  triggeredBy,
  phoneNumberLastFiveDigits,
  fastForwardServerMilliseconds,//TODO: To be used in future
  corp,
  nameOfLightweightNamespace,
  nameOfTestNamespace,
  nameOfProductionNamespace,
  branches,
  keyValuePairsJsonString,
  targetRootDomain,
  applicationName,
  containerPort,
  pathPattern,
  numberOfApplicationReplicas,
  needsDatabaseInstallation,
}) => {
  //Lifted from Google. Don't bother how it works. Just hashes a string and return a positive number.
  const hash = (str) => {
    let arr = str.split("");
    let result = arr.reduce(
      (hashCode, currentVal) =>
        (hashCode =
          currentVal.charCodeAt(0) +
          (hashCode << 6) +
          (hashCode << 16) -
          hashCode),
      0
    );
    return Math.abs(result);
  };

  const dockerEnvVarPrefix = "DOCKER_ENV_VAR";

  let numberOfReplicas = numberOfApplicationReplicas;
  let dbPodNeedsToBeDeployed = needsDatabaseInstallation; //TODO: Use this in kubectl command db part. If release and prod,then no. If angular,then no.

  let applicationBaseName = applicationName.split("-")[0];
  let applicationPostFix = applicationName.split("-")[1];
  if (!applicationBaseName || !applicationPostFix) {
    throw new Error(
      "The application should have a base name, a hyphen, and a postfix. E.g. myapp-api or myapp-ui"
    );
  }

  let dbSchemaName = applicationBaseName;
  let applicationNameForDatabase = applicationBaseName + "-" + "db";

  let containerPortForDatabase = "3306"; //TODO: Make this dynamic
  let servicePort = "80"; //TODO: Make this dynamic
  let servicePortForDatabase = "3306"; //TODO: Make this dynamic

  let branchRefToBeCheckedOut = "NA";
  let namespace = "NA";
  let deploymentName = "NA";
  let deploymentNameForDatabase = "NA";
  let groupName = "NA";
  let containerName = "NA";
  let containerNameForDatabase = "NA";
  let serviceName = "NA";
  let serviceNameForDatabase = "NA";
  let numericHashOfHostAndPort = "NA";
  let numericHashOfHostAndPortForDatabase = "NA";
  let hashBasedDBPassword = "NA";
  let ingressLbName = "NA";
  let hostName = "NA";
  let dockerImageNameAndTag = "NA";
  let env = "NA";

  const dockerPhraseForCommonEnvVariables = "COMMON";
  const envNameForProduction = "PROD";
  const envNameForTest = "TEST";
  const envNameForLightWeight = "LIGHTWEIGHT";

  const dockerEnvBaseVarKeyNameForDBHost = "DB_HOST";
  const dockerEnvBaseVarKeyNameForDBUsername = "DB_USERNAME";
  const dockerEnvBaseVarKeyNameForDBPassword = "DB_PASSWORD";
  const baseVarKeyNameForDBShowSql = "DB_SHOWSQL";
  const baseVarKeyNameForDBSchema = "DB_SCHEMA";

  containerName = applicationName;
  containerNameForDatabase = applicationNameForDatabase;

  if (context.eventName == "repository_dispatch") {
    console.log("This run is because of a respository_dispatch event");

    namespace = nameOfLightweightNamespace;
    numberOfReplicas = 1;

    if (
      //Any one should be true at a time, other should be false. If not, error out.
      (triggeredByAnotherApp == "true" && humanTriggered == "true") ||
      (triggeredByAnotherApp == "false" && humanTriggered == "false")
    ) {
      throw new Error(
        "Among triggeredByAnotherApp and humanTriggered, any ONE HAS to be true, and the other SHOULD be false."
      );
    }

    if (triggeredByAnotherApp == "true") {
      console.log(
        "This run is triggered because of another applications feature branch creation process. For e.g. if a feature branch is cut from myapp-ui, then myapp-api also needs to be deployed in order to complete the stack."
      );

      if (!featureBranchName) {
        throw new Error(
          "If triggeredByAnotherApp, featureBranchName needs to be sent."
        );
      } else {
        console.log(
          "Triggered with Feature branch name as: " + featureBranchName
        );
        console.log("Branches from GitHub are:" + branches);
        const branchArray = branches.split(",");
        const matchedBranch = branchArray.find(
          (branch) => branch == "feature/" + featureBranchName
        );
        if (matchedBranch) {
          console.log("Feature branch Exists: " + matchedBranch);
          branchRefToBeCheckedOut = context.ref;
          console.log(
            "Setting branchRefToBeCheckedOut to:" + branchRefToBeCheckedOut
          );
        } else {
          console.log(
            "Feature branch DOES NOT Exist. Going to use the code from release branch for deployment."
          );
          branchRefToBeCheckedOut = "refs/heads/release";
          console.log(
            "Setting branchRefToBeCheckedOut to:" + branchRefToBeCheckedOut
          );
        }
        groupName = featureBranchName;
        env = envNameForLightWeight;
        hostName = featureBranchName + "." + targetRootDomain;

        serviceName = applicationName + "-" + featureBranchName;
        serviceNameForDatabase =
          applicationNameForDatabase + "-" + featureBranchName;

        dockerImageNameAndTag =
          corp + "/" + applicationName + ":" + featureBranchName;
      }
    }

    if (humanTriggered == "true") {
      console.log(
        "This run has been triggered manually by a user. Going to use the code from release branch for deployment."
      );
      if (!triggeredBy || !phoneNumberLastFiveDigits) {
        throw new Error(
          "The properties:- triggeredBy and phoneNumberLastFiveDigits must be set"
        );
      }
      groupName = triggeredBy + "-" + phoneNumberLastFiveDigits;
      env = envNameForLightWeight;

      dockerImageNameAndTag =
        corp +
        "/" +
        applicationName +
        ":" +
        triggeredBy +
        "-" +
        phoneNumberLastFiveDigits;
      hostName =
        triggeredBy + "-" + phoneNumberLastFiveDigits + "." + targetRootDomain;
      serviceName =
        applicationName + "-" + triggeredBy + "-" + phoneNumberLastFiveDigits;
      serviceNameForDatabase =
        applicationNameForDatabase +
        "-" +
        triggeredBy +
        "-" +
        phoneNumberLastFiveDigits;
      branchRefToBeCheckedOut = "refs/heads/release";
      console.log(
        "Setting branchRefToBeCheckedOut to:" + branchRefToBeCheckedOut
      );
    }
  } else {
    console.log(
      "This run is an automated run which got triggered either because of a branch create, or a code commit. Will use the code from incoming branch itself."
    );

    branchRefToBeCheckedOut = context.ref;
    console.log(
      "Setting branchRefToBeCheckedOut to:" + branchRefToBeCheckedOut
    );

    if (context.ref == "refs/heads/main") {
      console.log("The current branch is: main");
      groupName = applicationName;
      env = envNameForProduction;
      serviceName = applicationName;
      serviceNameForDatabase = applicationNameForDatabase;
      namespace = nameOfProductionNamespace;
      hostName = targetRootDomain;
      dockerImageNameAndTag = corp + "/" + applicationName;
      numberOfReplicas = numberOfReplicas;
      dbPodNeedsToBeDeployed = false;
    }
    if (context.ref == "refs/heads/release") {
      console.log("The current branch is: release");
      groupName = applicationName;
      env = envNameForTest;
      serviceName = applicationName;
      serviceNameForDatabase = applicationNameForDatabase;
      namespace = nameOfTestNamespace;
      hostName = "test" + "." + targetRootDomain;
      dockerImageNameAndTag = corp + "/" + applicationName + ":" + "test";
      numberOfReplicas = numberOfReplicas;
      dbPodNeedsToBeDeployed = false;
    }
    if (context.ref.startsWith("refs/heads/feature/")) {
      featureBranchNameExcludingPrefix = context.ref.split(
        "refs/heads/feature/"
      )[1];
      console.log(
        "The current branch is a feature branch. The prefix is feature/ and the name is:" +
          featureBranchNameExcludingPrefix
      );
      groupName = featureBranchNameExcludingPrefix;
      env = envNameForLightWeight;

      serviceName = applicationName + "-" + featureBranchNameExcludingPrefix;
      serviceNameForDatabase =
        applicationNameForDatabase + "-" + featureBranchNameExcludingPrefix;

      hostName = featureBranchNameExcludingPrefix + "." + targetRootDomain;
      namespace = nameOfLightweightNamespace;
      dockerImageNameAndTag =
        corp + "/" + applicationName + ":" + featureBranchNameExcludingPrefix;
      numberOfReplicas = 1;

      console.log(
        "Triggering the other applications also in the stack, so that the deployment can work as a whole unit independently"
      );
    }
  }

  numericHashOfHostAndPort = hash(hostName + containerPort) % 1000; //Less than 1000
  numericHashOfHostAndPortForDatabase =
    hash(hostName + containerPortForDatabase) % 1000; //Less than 1000

  deploymentName = applicationName + "-" + groupName;
  deploymentNameForDatabase = applicationNameForDatabase + "-" + groupName;

  ingressLbName = "ingress-lb" + "-" + namespace;
  hashBasedDBPassword = hash(hostName) % 100000; //5 digit

  console.log("The list of secret keys " + keyValuePairsJsonString);
  const keyValuePairsJsonObj = JSON.parse(keyValuePairsJsonString);

  const envKeyPairsForDockerBuild = [];

  for (key in keyValuePairsJsonObj) {
    if (key.startsWith(dockerEnvVarPrefix + "_" + env)) {
      const value = keyValuePairsJsonObj[key];
      const strippedKey = key.replace(dockerEnvVarPrefix + "_" + env + "_", "");
      envKeyPairsForDockerBuild.push({ key: strippedKey, value: value });
    }
    if (
      key.startsWith(
        dockerEnvVarPrefix + "_" + dockerPhraseForCommonEnvVariables
      )
    ) {
      const value = keyValuePairsJsonObj[key];
      const strippedKey = key.replace(
        dockerEnvVarPrefix + "_" + dockerPhraseForCommonEnvVariables + "_",
        ""
      );
      envKeyPairsForDockerBuild.push({ key: strippedKey, value: value });
    }
  }

  if (env == envNameForLightWeight) {
    envKeyPairsForDockerBuild.push({
      key: dockerEnvBaseVarKeyNameForDBHost,
      value: "db-" + hostName,
    });
    envKeyPairsForDockerBuild.push({
      key: dockerEnvBaseVarKeyNameForDBUsername,
      value: "root",
    });
    envKeyPairsForDockerBuild.push({
      key: dockerEnvBaseVarKeyNameForDBPassword,
      value: hashBasedDBPassword,
    });
    envKeyPairsForDockerBuild.push({
      key: baseVarKeyNameForDBShowSql,
      value: true,
    });
    baseVarKeyNameForDBShowSql;
  } else {
    envKeyPairsForDockerBuild.push({
      key: baseVarKeyNameForDBShowSql,
      value: false,
    });
  }

  envKeyPairsForDockerBuild.push({
    key: baseVarKeyNameForDBSchema,
    value: dbSchemaName,
  });

  console.log(
    "Length of Docker env variables list to be applied to docker build:" +
      envKeyPairsForDockerBuild.length
  );

  let buildArgsCommandLineArgsForDockerBuild = "";

  for (element of envKeyPairsForDockerBuild) {
    console.log(element);
    const { key, value } = element;
    buildArgsCommandLineArgsForDockerBuild =
      buildArgsCommandLineArgsForDockerBuild +
      " --build-arg " +
      " " +
      key +
      "=" +
      value;
  }

  console.log(
    "Build args segment for Docker build command:" +
      buildArgsCommandLineArgsForDockerBuild
  );

  const resultObj = {
    branchRefToBeCheckedOut,
    namespace,
    deploymentName,
    deploymentNameForDatabase,
    numberOfReplicas,
    containerName,
    containerNameForDatabase,
    containerPort,
    containerPortForDatabase,
    serviceName,
    serviceNameForDatabase,
    servicePort,
    servicePortForDatabase,
    numericHashOfHostAndPort,
    numericHashOfHostAndPortForDatabase,
    ingressLbName,
    hostName,
    pathPattern,
    dockerImageNameAndTag,
    dbSchemaName,
    hashBasedDBPassword,
    buildArgsCommandLineArgsForDockerBuild,
    dbPodNeedsToBeDeployed,
  };

  console.log("Result Object:" + JSON.stringify(resultObj));

  return JSON.stringify(resultObj);
};
