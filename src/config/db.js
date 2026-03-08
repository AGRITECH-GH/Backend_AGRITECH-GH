import pg from 'pg';
// Deconstruct Pool from the imported pg object
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // maximum number of clients in the pool
    idleTimeoutMillis: 30000, // close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // return an error if a connection cannot be established within 2 seconds
});

//error handling for idle clients
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});


export default pool;
