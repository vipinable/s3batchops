import { Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as path from 'path';
export class LambdaWithLayer extends Stack {
//BeginStackDefinition
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    console.log('accessing context 👉', this.node.tryGetContext('fromApp'));

    //Lambda layer creation definition
    const layer0 = new lambda.LayerVersion(this, 'LayerVersion', {
      compatibleRuntimes: [
        lambda.Runtime.PYTHON_3_6,
        lambda.Runtime.PYTHON_3_7,
        lambda.Runtime.PYTHON_3_8,
      ],
      code: lambda.Code.fromAsset(path.join(__dirname,'../../layer/bin')),
      });

    const s3Bucket = new s3.Bucket(this, 's3inventory', {
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
    });

    s3Bucket.grantRead(new iam.AccountRootPrincipal());
    s3Bucket.grantPut(new iam.AccountRootPrincipal());


    //IAM Lambda Execution custom role 
    const LambdaExecRole = new iam.Role(this, 'LambdaExecRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Lambda Execution Role',
    });

    LambdaExecRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
      ],
    }));

    //S3 batch operations job role
    const s3cRole = new iam.Role(this, 's3cRole', {
      assumedBy: new iam.ArnPrincipal('batchoperations.s3.amazonaws.com'),
      description: 'S3 batch operations job role',
    });
    
    s3cRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [
        'arn:aws:s3:::tempbackupbkt/*'
      ],
      actions: [
          's3:PutObject',
          's3:PutObjectAcl',
          's3:PutObjectTagging',
      ],
    }));

    s3cRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [
        "arn:aws:s3:::xlsreport-test-www",
        "arn:aws:s3:::xlsreport-test-www/*"
      ],
      actions: [
        "s3:GetObject",
        "s3:GetObjectAcl",
        "s3:GetObjectTagging",
        "s3:ListBucket",
      ],
    }));

    s3cRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: [
        s3Bucket.arnForObjects('*'),
      ],
      actions: [
          "s3:PutObject",
          "s3:GetObject",
          "s3:GetObjectVersion"
      ],
    }));
          
    //Main function definition
    const fn = new lambda.Function(this, 'Function', {
      description: 'S3 batch operations management function',
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'main.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../src')),
      memorySize: 512,
      timeout: Duration.seconds(300),
      environment: {
        APPNAME: process.env.ApplicationName!,
        ENVNAME: process.env.Environment!, 
        SOURCE_BUCKET: 'xlsreport-test-www',
        SINK_BUCKET: 'tempbackupbkt',
        ROLE_ARN: s3cRole.roleArn
      },
      });

  //EndStack
  }}
