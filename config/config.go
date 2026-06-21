package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/molu/chainvault/pkg/logger"
	"github.com/spf13/viper"
)

type Config struct {
	VaultAddress   string `mapstructure:"vault_address"`
	VaultToken     string `mapstructure:"vault_token"`
	VaultRoleID          string `mapstructure:"vault_role_id"`
	VaultSecretID        string `mapstructure:"vault_secret_id"`
	VaultSecretIDWrapped bool   `mapstructure:"vault_secret_id_wrapped"` // true = vault_secret_id is a wrapping token that must be unwrapped
	VaultSecretIDFile    string `mapstructure:"vault_secret_id_file"`    // K8s: path to file containing the wrapped SecretID
	VaultNamespace       string `mapstructure:"vault_namespace"`
	VaultSignRoleID      string `mapstructure:"signtx_vault_role_id"`   // Dedicated role for signtx worker
	VaultSignSecretID    string `mapstructure:"signtx_vault_secret_id"` // Dedicated secret for signtx worker
	MasterSeedID         string `mapstructure:"master_seed_id"`         // Vault KV wallet ID for master mnemonic
	DatabaseURL        string `mapstructure:"database_url"`
	TradingDatabaseURL string `mapstructure:"trading_database_url"` // chainvault_trading DB
	HMACSecret     string `mapstructure:"hmac_secret"` // Cryptographic secret for signing jobs
	JWTSecret      string `mapstructure:"jwt_secret"`
	SMTPHost       string `mapstructure:"smtp_host"`
	SMTPPort       int    `mapstructure:"smtp_port"`
	SMTPUser       string `mapstructure:"smtp_user"`
	SMTPPass       string `mapstructure:"smtp_pass"`
	FromEmail      string `mapstructure:"from_email"`
	AdminEmail     string `mapstructure:"admin_email"`
	AppBaseURL     string `mapstructure:"app_base_url"`
	ApiHTTP        string `mapstructure:"api_http"`
	FrontendURL    string `mapstructure:"frontend_url"`
	AdminFrontendURL string `mapstructure:"admin_frontend_url"`
	AgentFrontendURL string `mapstructure:"agent_frontend_url"`
	TradingApiURL  string `mapstructure:"trading_api_url"`


	// IMAP Config
	IMAPHost    string `mapstructure:"imap_host"`
	IMAPPort    int    `mapstructure:"imap_port"`
	IMAPUser    string `mapstructure:"imap_user"`
	IMAPPass    string `mapstructure:"imap_pass"`
	IMAPMailbox string `mapstructure:"imap_mailbox"`
	IMAPUseTLS  bool   `mapstructure:"imap_use_tls"`

	// Cold wallet addresses (air-gapped; admin-managed via env/config only).
	// Hot, warm, and gas_tank wallets are generated and stored in the
	// system_wallets database table — see internal/syswallets.
	EthColdWallet  string `mapstructure:"eth_cold_wallet"`
	BSCColdWallet  string `mapstructure:"bsc_cold_wallet"`
	TronColdWallet string `mapstructure:"tron_cold_wallet"`
	SolColdWallet  string `mapstructure:"sol_cold_wallet"`
	BTCColdWallet  string `mapstructure:"btc_cold_wallet"`
	LTCColdWallet  string `mapstructure:"ltc_cold_wallet"`
	DOGEColdWallet string `mapstructure:"doge_cold_wallet"`
	DASHColdWallet string `mapstructure:"dash_cold_wallet"`
	BCHColdWallet  string `mapstructure:"bch_cold_wallet"`
	XRPColdWallet  string `mapstructure:"xrp_cold_wallet"`
	SkipCatchup    bool   `mapstructure:"skip_catchup"`
	StartBlock     uint64 `mapstructure:"start_block"`
	WebhookURL     string `mapstructure:"webhook_url"`
	USDCContractAddr  string `mapstructure:"usdc_contract_address"`
	USDTContractAddr  string `mapstructure:"usdt_contract_address"`
	EURCContractAddr  string `mapstructure:"eurc_contract_address"`
	SepoliaUSDCAddr   string `mapstructure:"sepolia_usdc_address"`
	SepoliaUSDTAddr   string `mapstructure:"sepolia_usdt_address"`
	SepoliaEURCAddr   string `mapstructure:"sepolia_eurc_address"`

	// BSC Config
	BSCApiURL   string `mapstructure:"bsc_api_url"`
	BSCApiKey   string `mapstructure:"bsc_api_key"`
	BSCUSDCAddr string `mapstructure:"bsc_usdc_address"`
	BSCUSDTAddr string `mapstructure:"bsc_usdt_address"`
	BSCBUSDAddr string `mapstructure:"bsc_busd_address"`
	BSCTestnetUSDCAddr string `mapstructure:"bsctestnet_usdc_address"`
	BSCTestnetUSDTAddr string `mapstructure:"bsctestnet_usdt_address"`
	BSCTestnetBUSDAddr string `mapstructure:"bsctestnet_busd_address"`
	BSCNodeType string `mapstructure:"bsc_node_type"` // self or api

	// Tron Config
	TronApiURL                string `mapstructure:"tron_api_url"`
	TronApiKey                string `mapstructure:"tron_api_key"`
	TronUSDTAddr              string `mapstructure:"tron_usdt_address"`
	TronTestnetUSDTAddr       string `mapstructure:"tron_testnet_usdt_address"` // Handles Shasta/Nile
	TronNodeType              string `mapstructure:"tron_node_type"` // self or api
	MaxTransactionLimit       string `mapstructure:"max_transaction_limit"`
	MempoolWorkers            int    `mapstructure:"mempool_workers"`
	PublicURL                 string `mapstructure:"public_url"`
	RequiredConfirmations     int    `mapstructure:"required_confirmations"`
	EthRequiredConfirmations  int    `mapstructure:"eth_required_confirmations"`
	BSCRequiredConfirmations  int    `mapstructure:"bsc_required_confirmations"`
	TronRequiredConfirmations int    `mapstructure:"tron_required_confirmations"`
	SolRequiredConfirmations  int    `mapstructure:"sol_required_confirmations"`

	// Solana Config
	SolUSDCAddr  string `mapstructure:"sol_usdc_address"`
	SolUSDTAddr  string `mapstructure:"sol_usdt_address"`
	SolEURCAddr  string `mapstructure:"sol_eurc_address"`
	SolDevnetUSDCAddr  string `mapstructure:"sol_devnet_usdc_address"`
	SolDevnetUSDTAddr  string `mapstructure:"sol_devnet_usdt_address"`
	SolDevnetEURCAddr  string `mapstructure:"sol_devnet_eurc_address"`
	SolTokenProgramAddr string `mapstructure:"sol_token_program_address"`
	SolAssocTokenProgramAddr string `mapstructure:"sol_assoc_token_program_address"`

	// Deposit Recovery
	MaxComplaintAgeDays int `mapstructure:"max_complaint_age_days"` // default 30

	// Bloom Filter Config (indexer address lookup)
	BloomCapacity        uint    `mapstructure:"bloom_capacity"`          // default 10_000_000
	BloomFPR             float64 `mapstructure:"bloom_fpr"`               // default 0.001 (0.1%)
	BloomRefreshSeconds  int     `mapstructure:"bloom_refresh_seconds"`   // default 600 (10min)

	// Consolidation Percentages
	HotPercentage  float64 `mapstructure:"hot_percentage"`
	WarmPercentage float64 `mapstructure:"warm_percentage"`
	ColdPercentage float64 `mapstructure:"cold_percentage"`

	// Worker Pool Scaling
	WorkerMin int `mapstructure:"worker_min"`
	WorkerMax int `mapstructure:"worker_max"`

	// VaultPluginMountPath is the Vault mount path for the ChainVault signing plugin.
	// All runtime transaction signing is delegated here — private keys never leave the plugin.
	VaultPluginMountPath string `mapstructure:"vault_plugin_mount_path"`

	// Crypto Pricing & FX
	CryptoApiURL     string        `mapstructure:"crypto_api_url"`
	CryptoApiKey     string        `mapstructure:"crypto_api_key"`
	CryptoCacheTTL   time.Duration `mapstructure:"crypto_cache_ttl"`
	FXApiURL         string        `mapstructure:"fx_api_url"`
	FXApiKey         string        `mapstructure:"fx_api_key"`
	FXCacheTTL       time.Duration `mapstructure:"fx_cache_ttl"`
	SupportedSymbols []string      `mapstructure:"supported_symbols"`
	// Redis Config
	RedisURL      string `mapstructure:"redis_url"`
	RedisPassword string `mapstructure:"redis_password"`
	RedisDB       int    `mapstructure:"redis_db"`
	RedisMode     string `mapstructure:"redis_mode"`

	// Signing Queue Config
	SigningQueueName        string `mapstructure:"signing_queue_name"`
	SigningVisibilityTimeout int    `mapstructure:"signing_visibility_timeout"` // seconds
	SigningMaxRetries       int    `mapstructure:"signing_max_retries"`

	// Deposit Queue Config
	DepositQueueName           string `mapstructure:"deposit_queue_name"`
	DepositVisibilityTimeout   int    `mapstructure:"deposit_visibility_timeout"` // seconds
	DepositWorkerMin           int    `mapstructure:"deposit_worker_min"`
	DepositWorkerMax           int    `mapstructure:"deposit_worker_max"`

	KafkaBrokers     []string      `mapstructure:"kafka_brokers"`
	KafkaClientID    string        `mapstructure:"kafka_client_id"`
	AppEnv           string        `mapstructure:"app_env"`
	PaystackSecretKey string       `mapstructure:"paystack_secret_key"`
	PaystackPublicKey string       `mapstructure:"paystack_public_key"`
	PollInterval      time.Duration `mapstructure:"poll_interval"`
	MonitorEnabledChains []string  `mapstructure:"monitor_enabled_chains"`
	MonitorControlPort   int       `mapstructure:"monitor_control_port"`
	SweeperEnabled       bool      `mapstructure:"sweeper_enabled"`
	GoogleClientID       string    `mapstructure:"google_client_id"`
	GoogleClientSecret   string    `mapstructure:"google_client_secret"`
	GoogleRedirectURL    string    `mapstructure:"google_redirect_url"`
	ReuseMainChainAddress bool     `mapstructure:"reuse_main_chain_address"`

	// UTXORegtest forces UTXO address derivation to use regtest params.
	// Useful during local development when running bitcoind in regtest mode.
	// Set utxo_regtest=true in app.env. Takes precedence over testnet for UTXO chains.
	UTXORegtest bool `mapstructure:"utxo_regtest"`

	// RiskScore Integration
	RiskEngineMode    string `mapstructure:"risk_engine_mode"` // remote | embedded | disabled
	RiskEngineURL     string `mapstructure:"risk_engine_url"`
	RiskMLSidecarURL  string `mapstructure:"risk_ml_sidecar_url"`
	RiskMLSidecarEnabled bool `mapstructure:"risk_ml_sidecar_enabled"`

	LithicAPIKey      string `mapstructure:"lithic_api_key"`
	LithicWebhookKey  string `mapstructure:"lithic_webhook_key"`
	GeoIPDBPath       string `mapstructure:"geoip_db_path"`
	PersonaAPIKey     string `mapstructure:"persona_api_key"`
	PersonaTemplateID string `mapstructure:"persona_template_id"`
	PersonaWebhookKey string `mapstructure:"persona_webhook_key"`
	PersonaDisabled   bool   `mapstructure:"persona_disabled"`

	// Logging
	LogLevel  string `mapstructure:"log_level"`
	LogDir    string `mapstructure:"log_dir"`
	LogPrefix string `mapstructure:"log_prefix"`

	TOTPIssuer string `mapstructure:"totp_issuer"`
}

// LoadConfig reads app.env from project root
func LoadConfig() (cfg Config, err error) {
	// Determine project root
	rootPath := os.Getenv("PROJECT_ROOT")
	if rootPath == "" {
		cwd, _ := os.Getwd()
		// If we're in cmd/xxx, the root is two levels up
		rootPath = cwd
		for i := 0; i < 3; i++ {
			if _, err := os.Stat(filepath.Join(rootPath, "go.mod")); err == nil {
				break
			}
			rootPath = filepath.Join(rootPath, "..")
		}
	}

	viper.SetConfigName("app") // app.env
	viper.SetConfigType("env")
	viper.AddConfigPath(".")
	viper.AddConfigPath(rootPath)
	// Also add common locations
	viper.AddConfigPath(filepath.Join(rootPath, "cmd"))

	viper.AutomaticEnv() // allow ENV vars to override file
	viper.SetDefault("required_confirmations", 6)
	viper.SetDefault("eth_required_confirmations", 6)
	viper.SetDefault("bsc_required_confirmations", 12)
	viper.SetDefault("tron_required_confirmations", 19)
	viper.SetDefault("sol_required_confirmations", 32)
	viper.SetDefault("sol_required_confirmations", 32)
	viper.SetDefault("hot_percentage", 20.0)
	viper.SetDefault("warm_percentage", 30.0)
	viper.SetDefault("cold_percentage", 50.0)
	viper.SetDefault("worker_min", 1)
	viper.SetDefault("worker_max", 50)
	viper.SetDefault("vault_plugin_mount_path", "chainvault")
	viper.SetDefault("fx_cache_ttl", 1*time.Hour)
	viper.SetDefault("app_env", "development")
	viper.SetDefault("trading_database_url", "")  // chainvault_trading — set in app.env
	viper.SetDefault("app_base_url", "http://localhost:8080")
	viper.SetDefault("api_http", ":8080")
	viper.SetDefault("frontend_url", "http://localhost:3000")
	viper.SetDefault("admin_frontend_url", "http://localhost:3001")
	viper.SetDefault("agent_frontend_url", "http://localhost:3002")
	viper.SetDefault("trading_api_url", "http://localhost:8080")

	viper.SetDefault("imap_mailbox", "INBOX")
	viper.SetDefault("imap_port", 993)
	viper.SetDefault("imap_use_tls", true)
	viper.SetDefault("sol_token_program_address", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")
	viper.SetDefault("sol_assoc_token_program_address", "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL")
	viper.SetDefault("supported_symbols", []string{"BTC", "ETH", "SOL", "BNB", "ADA", "XRP", "DOGE", "AVAX", "TRX", "USDT", "USDC", "EURC", "BUSD"})

	viper.SetDefault("redis_url", "localhost:6379")
	viper.SetDefault("redis_db", 0)
	viper.SetDefault("redis_mode", "standalone")
	viper.SetDefault("signing_queue_name", "signing_jobs")
	viper.SetDefault("signing_visibility_timeout", 300) // 5 minutes
	viper.SetDefault("signing_max_retries", 3)

	viper.SetDefault("deposit_queue_name", "deposit_events")
	viper.SetDefault("deposit_visibility_timeout", 300) // 5 minutes
	viper.SetDefault("deposit_worker_min", 1)
	viper.SetDefault("deposit_worker_max", 20)
	viper.SetDefault("reuse_main_chain_address", false)

	viper.SetDefault("risk_engine_mode", "disabled")
	viper.SetDefault("risk_engine_url", "http://localhost:8080")
	viper.SetDefault("risk_ml_sidecar_enabled", false)

	viper.SetDefault("kafka_brokers", []string{"localhost:9092"})
	viper.SetDefault("kafka_client_id", "chainvault")
	viper.SetDefault("geoip_db_path", "./GeoLite2-City.mmdb")

	viper.SetDefault("log_level", "info")
	viper.SetDefault("log_dir", "./logs")
	viper.SetDefault("log_prefix", "chainvault-")
	viper.SetDefault("monitor_control_port", 8083)
	viper.SetDefault("totp_issuer", "ChainVault")

	err = viper.ReadInConfig()
	if err != nil {
		return cfg, fmt.Errorf("failed to read config: %w (searched in . and %s)", err, rootPath)
	}

	err = viper.Unmarshal(&cfg)
	if err != nil {
		return cfg, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	if cfg.PollInterval == 0 {
		cfg.PollInterval = 5 * time.Minute
	}

	// Initialize Logger with config
	logger.Init(logger.Config{
		Level:     cfg.LogLevel,
		LogDir:    cfg.LogDir,
		LogPrefix: cfg.LogPrefix,
		Pretty:    cfg.AppEnv != "production",
	})

	logger.Get().Info().Msgf("Loaded config: Env=%s, LogDir=%s, LogPrefix=%s, Vault=%s",
		cfg.AppEnv, cfg.LogDir, cfg.LogPrefix, cfg.VaultAddress)

	return cfg, nil
}

// GetColdWallet returns the cold wallet address for the given chain from config.
// For runtime lookups (hot, warm, gas_tank) use internal/syswallets.Resolver,
// which resolves addresses from the system_wallets database table.
func (c *Config) GetColdWallet(chain string) string {
	switch chain {
	case "ethereum":
		return c.EthColdWallet
	case "bsc":
		return c.BSCColdWallet
	case "tron":
		return c.TronColdWallet
	case "solana", "sol":
		return c.SolColdWallet
	case "bitcoin", "btc":
		return c.BTCColdWallet
	case "litecoin", "ltc":
		return c.LTCColdWallet
	case "dogecoin", "doge":
		return c.DOGEColdWallet
	case "dash":
		return c.DASHColdWallet
	case "bitcoincash", "bch":
		return c.BCHColdWallet
	case "ripple", "xrp":
		return c.XRPColdWallet
	}
	return ""
}

func (c *Config) GetGasTank(chain string) string {
	// Gas tank addresses are now stored in system_wallets DB.
	// Use syswallets.Resolver.GetGasTankWallet instead.
	return ""
}

func (c *Config) GetTokenAddress(chain string, symbol string) string {
	switch chain {
	case "ethereum":
		switch symbol {
		case "USDC":
			return c.USDCContractAddr
		case "USDT":
			return c.USDTContractAddr
		case "EURC":
			return c.EURCContractAddr
		}
	case "sepolia":
		switch symbol {
		case "USDC":
			return c.SepoliaUSDCAddr
		case "USDT":
			return c.SepoliaUSDTAddr
		case "EURC":
			return c.SepoliaEURCAddr
		}
	case "bsc":
		switch symbol {
		case "USDC":
			return c.BSCUSDCAddr
		case "USDT":
			return c.BSCUSDTAddr
		case "BUSD":
			return c.BSCBUSDAddr
		}
	case "bsctestnet":
		switch symbol {
		case "USDC":
			return c.BSCTestnetUSDCAddr
		case "USDT":
			return c.BSCTestnetUSDTAddr
		case "BUSD":
			return c.BSCTestnetBUSDAddr
		}
	case "tron":
		switch symbol {
		case "USDT":
			return c.TronUSDTAddr
		}
	case "tronshasta", "tronnile":
		switch symbol {
		case "USDT":
			return c.TronTestnetUSDTAddr
		}
	case "solana", "sol":
		switch symbol {
		case "USDC":
			return c.SolUSDCAddr
		case "USDT":
			return c.SolUSDTAddr
		case "EURC":
			return c.SolEURCAddr
		}
	case "solanadevnet":
		switch symbol {
		case "USDC":
			return c.SolDevnetUSDCAddr
		case "USDT":
			return c.SolDevnetUSDTAddr
		case "EURC":
			return c.SolDevnetEURCAddr
		}
	}
	return ""
}

func (c *Config) GetRequiredConfirmations(chain string) int {
	// For development/local testing, only require 1 confirmation to speed up the loop.
	env := strings.ToLower(c.AppEnv)
	if env == "development" || env == "local" || env == "" {
		return 1
	}

	switch chain {
	case "ethereum":
		if c.EthRequiredConfirmations > 0 {
			return c.EthRequiredConfirmations
		}
	case "sepolia":
		if c.EthRequiredConfirmations > 0 {
			return c.EthRequiredConfirmations
		}
	case "bsc":
		if c.BSCRequiredConfirmations > 0 {
			return c.BSCRequiredConfirmations
		}
	case "bsctestnet":
		if c.BSCRequiredConfirmations > 0 {
			return c.BSCRequiredConfirmations
		}
	case "tron":
		if c.TronRequiredConfirmations > 0 {
			return c.TronRequiredConfirmations
		}
	case "solana", "sol":
		if c.SolRequiredConfirmations > 0 {
			return c.SolRequiredConfirmations
		}
	}
	return c.RequiredConfirmations
}

func (c *Config) GetTokensForChain(chain string) map[string]string {
	tokens := make(map[string]string)
	switch chain {
	case "ethereum":
		if c.USDCContractAddr != "" {
			tokens["USDC"] = c.USDCContractAddr
		}
		if c.USDTContractAddr != "" {
			tokens["USDT"] = c.USDTContractAddr
		}
		if c.EURCContractAddr != "" {
			tokens["EURC"] = c.EURCContractAddr
		}
	case "sepolia":
		if c.SepoliaUSDCAddr != "" {
			tokens["USDC"] = c.SepoliaUSDCAddr
		}
		if c.SepoliaUSDTAddr != "" {
			tokens["USDT"] = c.SepoliaUSDTAddr
		}
		if c.SepoliaEURCAddr != "" {
			tokens["EURC"] = c.SepoliaEURCAddr
		}
	case "bsc":
		if c.BSCUSDCAddr != "" {
			tokens["USDC"] = c.BSCUSDCAddr
		}
		if c.BSCUSDTAddr != "" {
			tokens["USDT"] = c.BSCUSDTAddr
		}
		if c.BSCBUSDAddr != "" {
			tokens["BUSD"] = c.BSCBUSDAddr
		}
	case "bsctestnet":
		if c.BSCTestnetUSDCAddr != "" {
			tokens["USDC"] = c.BSCTestnetUSDCAddr
		}
		if c.BSCTestnetUSDTAddr != "" {
			tokens["USDT"] = c.BSCTestnetUSDTAddr
		}
		if c.BSCTestnetBUSDAddr != "" {
			tokens["BUSD"] = c.BSCTestnetBUSDAddr
		}
	case "tron":
		if c.TronUSDTAddr != "" {
			tokens["USDT"] = c.TronUSDTAddr
		}
	case "tronshasta", "tronnile":
		if c.TronTestnetUSDTAddr != "" {
			tokens["USDT"] = c.TronTestnetUSDTAddr
		}
	case "solana", "sol":
		if c.SolUSDCAddr != "" {
			tokens["USDC"] = c.SolUSDCAddr
		}
		if c.SolUSDTAddr != "" {
			tokens["USDT"] = c.SolUSDTAddr
		}
		if c.SolEURCAddr != "" {
			tokens["EURC"] = c.SolEURCAddr
		}
	case "solanadevnet":
		if c.SolDevnetUSDCAddr != "" {
			tokens["USDC"] = c.SolDevnetUSDCAddr
		}
		if c.SolDevnetUSDTAddr != "" {
			tokens["USDT"] = c.SolDevnetUSDTAddr
		}
		if c.SolDevnetEURCAddr != "" {
			tokens["EURC"] = c.SolDevnetEURCAddr
		}
	}
	return tokens
}

func (c *Config) GetCurrencyByTokenAddress(chain, contractAddr string) string {
	normalize := func(addr string) string {
		trimmed := strings.TrimSpace(addr)
		checkChain := strings.ToLower(chain)
		if checkChain == "tron" || checkChain == "trx" {
			return trimmed
		}
		return strings.ToLower(trimmed)
	}

	normalizedInput := normalize(contractAddr)
	for symbol, addr := range c.GetTokensForChain(chain) {
		if normalize(addr) == normalizedInput {
			return symbol
		}
	}
	return ""
}

func (c *Config) IsTestnet(chain string) bool {
	// Simple heuristic: if app_env is development/staging OR chain name suggests testnet
	env := strings.ToLower(c.AppEnv)
	if env == "development" || env == "staging" || env == "test" {
		return true
	}
	return strings.Contains(strings.ToLower(chain), "testnet") || strings.Contains(strings.ToLower(chain), "sepolia") || strings.Contains(strings.ToLower(chain), "devnet")
}

func (c *Config) IsMainnet(chain string) bool {
	return !c.IsTestnet(chain)
}

// IsRegtest returns true when UTXO chains should use regtest address params.
// This is controlled by utxo_regtest=true in app.env and takes precedence over
// testnet for UTXO derivation (bitcoin, litecoin, dogecoin, dash, bitcoincash).
func (c *Config) IsRegtest() bool {
	return c.UTXORegtest
}

// GetMaxComplaintAge returns the maximum age a transaction can be for deposit complaint submission.
// Transactions older than this are rejected at submission time so they never enter the admin queue.
func (c *Config) GetMaxComplaintAge(chain string) time.Duration {
	days := c.MaxComplaintAgeDays
	if days <= 0 {
		days = 30 // global default: 30 days
	}
	return time.Duration(days) * 24 * time.Hour
}
