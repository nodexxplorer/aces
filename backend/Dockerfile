FROM golang:1.23-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o api ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /home/appuser/

COPY --from=builder /app/api .
COPY --from=builder /app/internal/db/migrations ./migrations
RUN mkdir -p /home/appuser/uploads && chown -R appuser:appgroup /home/appuser

USER appuser

EXPOSE 8080
CMD ["./api"]
