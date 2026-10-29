import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'

export async function database(t) {
    const client = createClient({url:'file::memory:'})
    t.after(()=>client.close())
    const journal=JSON.parse(fs.readFileSync('drizzle/meta/_journal.json','utf8'))
    for(const entry of journal.entries) await client.executeMultiple(fs.readFileSync(`drizzle/${entry.tag}.sql`,'utf8'))
    await client.execute("INSERT INTO organization(id,name,slug,created_at) VALUES ('a','A','a',0),('b','B','b',0)")
    await client.execute("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES ('u','User','u@example.test',1,0,0)")
    await client.execute("INSERT INTO status(id,status) VALUES (1,'Nuevo')")
    await client.execute("INSERT INTO priority(id,priority) VALUES (1,'Normal')")
    return client
}
// Load the real TypeScript service with only the database and after() replaced.
// All queries, joins, encryption, claims and processing run unchanged.
export function service(client) {
    const cache=new Map()
    const db=drizzle(client)
    function load(file) {
        file=path.resolve(file)
        if(cache.has(file))return cache.get(file).exports
        const loaded={exports:{}};cache.set(file,loaded)
        const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
        const native=createRequire(file)
        const require=id=>{
            if(id==='@/db')return {db}
            if(id==='next/server')return {after(){}}
            if(id.startsWith('@/'))return load(path.resolve(id.slice(2)+'.ts'))
            if(id.startsWith('.'))return load(path.resolve(path.dirname(file),id+'.ts'))
            return native(id)
        }
        vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename:file})(require,loaded,loaded.exports)
        return loaded.exports
    }
    return { sheets:load('lib/integrations/google-sheets.ts'), access:load('lib/organization-access.ts'), appsScript:load('lib/integrations/google-sheets-apps-script.ts') }
}
