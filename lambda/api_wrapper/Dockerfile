# Use the AWS Lambda Python 3.13 base image
FROM --platform=arm64 public.ecr.aws/lambda/python:3.13

COPY . ${LAMBDA_TASK_ROOT}

RUN pip install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

EXPOSE 8080

CMD ["main.lambda_handler"]